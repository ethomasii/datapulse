import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema } from "@/lib/elt/types";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { syncDltDbtWithCanvas } from "@/lib/elt/dbt-canvas";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.eltPipeline.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      description: true,
      updatedAt: true,
      defaultTargetAgentTokenId: true,
    },
  });
  return NextResponse.json({ pipelines: rows });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = createPipelineBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const body = parsed.data;
  const mergedSourceConfiguration = mergeEltMetadataIntoSourceConfig(body);
  syncDltDbtWithCanvas(mergedSourceConfiguration);
  const bodyMerged = { ...body, sourceConfiguration: mergedSourceConfiguration };
  const resolvedTool = resolveTool(bodyMerged);

  try {
    const existing = await db.eltPipeline.findUnique({
      where: {
        userId_name_tool: {
          userId: user.id,
          name: body.name,
          tool: resolvedTool,
        },
      },
      select: { id: true },
    });
    if (existing) {
      return NextResponse.json(
        { error: `A pipeline named "${body.name}" already exists for tool "${resolvedTool}".` },
        { status: 409 }
      );
    }

    const { pipelineCode, configYaml, workspaceYaml } = generatePipelineArtifacts(bodyMerged);

    let runsWebhookUrl: string | null = null;
    try {
      runsWebhookUrl = normalizeRunWebhookUrl(bodyMerged.runsWebhookUrl);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Invalid webhook URL";
      return NextResponse.json({ error: msg }, { status: 400 });
    }

    let defaultTargetAgentTokenId: string | null | undefined;
    if (body.defaultTargetAgentTokenId !== undefined) {
      if (body.defaultTargetAgentTokenId === null) {
        defaultTargetAgentTokenId = null;
      } else {
        try {
          await assertUserOwnsGatewayToken(user.id, body.defaultTargetAgentTokenId);
          defaultTargetAgentTokenId = body.defaultTargetAgentTokenId;
        } catch {
          return NextResponse.json({ error: "Invalid default gateway" }, { status: 400 });
        }
      }
    }

    const row = await db.eltPipeline.create({
      data: {
        userId: user.id,
        name: bodyMerged.name,
        tool: resolvedTool,
        sourceType: bodyMerged.sourceType,
        destinationType: bodyMerged.destinationType,
        description: bodyMerged.description ?? null,
        groupName: bodyMerged.groupName ?? null,
        sourceConfiguration: mergedSourceConfiguration as object,
        pipelineCode,
        configYaml,
        workspaceYaml,
        runsWebhookUrl,
        ...(defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId } : {}),
      },
    });

    return NextResponse.json({ pipeline: row }, { status: 201 });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
