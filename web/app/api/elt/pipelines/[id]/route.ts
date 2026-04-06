import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";
import { mergeSourceConfigurationForSourceTypeChange } from "@/lib/elt/merge-source-config-on-type-change";

const canvasPayloadSchema = z.union([
  z.object({
    nodes: z.array(z.unknown()),
    edges: z.array(z.unknown()),
    v: z.number().optional(),
  }),
  z.null(),
]);

/** PATCH body: any combination of canvas, types, and enabled (at least one required). */
const pipelinePatchSchema = z
  .object({
    canvas: canvasPayloadSchema.optional(),
    enabled: z.boolean().optional(),
    sourceType: z.string().min(1).optional(),
    destinationType: z.string().min(1).optional(),
    /** Full replacement for `source_configuration` (same shape as form builder / JSON tab). */
    sourceConfiguration: z.record(z.string(), z.any()).optional(),
  })
  .refine(
    (d) =>
      d.canvas !== undefined ||
      typeof d.enabled === "boolean" ||
      d.sourceType !== undefined ||
      d.destinationType !== undefined ||
      d.sourceConfiguration !== undefined,
    { message: "No updatable fields" }
  );

type Ctx = { params: { id: string } };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const row = await db.eltPipeline.findFirst({
      where: { id: ctx.params.id, userId: user.id },
    });
    if (!row) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }
    return NextResponse.json({ pipeline: row });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const res = await db.eltPipeline.deleteMany({
    where: { id: ctx.params.id, userId: user.id },
  });
  if (res.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, ctx: Ctx) {
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
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const body = parsed.data;
  const mergedSourceConfiguration = mergeEltMetadataIntoSourceConfig(body);
  const bodyMerged = { ...body, sourceConfiguration: mergedSourceConfiguration };

  try {
    const existing = await db.eltPipeline.findFirst({
      where: { id: ctx.params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resolvedTool = resolveTool(bodyMerged);

    if (existing.name !== bodyMerged.name || existing.tool !== resolvedTool) {
      const conflict = await db.eltPipeline.findUnique({
        where: {
          userId_name_tool: {
            userId: user.id,
            name: bodyMerged.name,
            tool: resolvedTool,
          },
        },
        select: { id: true },
      });
      if (conflict && conflict.id !== existing.id) {
        return NextResponse.json(
          { error: `A pipeline named "${body.name}" already exists for tool "${resolvedTool}".` },
          { status: 409 }
        );
      }
    }

    const { pipelineCode, configYaml, workspaceYaml } = generatePipelineArtifacts(bodyMerged);

    let runsWebhookUrl: string | null | undefined;
    if (body.runsWebhookUrl !== undefined) {
      try {
        runsWebhookUrl = normalizeRunWebhookUrl(body.runsWebhookUrl);
      } catch (e) {
        const msg = e instanceof Error ? e.message : "Invalid webhook URL";
        return NextResponse.json({ error: msg }, { status: 400 });
      }
    }

    const row = await db.eltPipeline.update({
      where: { id: existing.id },
      data: {
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
        ...(runsWebhookUrl !== undefined ? { runsWebhookUrl } : {}),
      },
    });

    return NextResponse.json({ pipeline: row });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
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

  const parsed = pipelinePatchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }
  const p = parsed.data;

  const onlyEnabled =
    typeof p.enabled === "boolean" &&
    p.canvas === undefined &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined;

  try {
    if (onlyEnabled) {
      const row = await db.eltPipeline.updateMany({
        where: { id: ctx.params.id, userId: user.id },
        data: { enabled: p.enabled },
      });
      if (row.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: ctx.params.id, userId: user.id },
      });
      return NextResponse.json({ pipeline });
    }

    const existing = await db.eltPipeline.findFirst({
      where: { id: ctx.params.id, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let base = { ...(existing.sourceConfiguration as Record<string, unknown>) };
    let sourceType = existing.sourceType;
    let destinationType = existing.destinationType;

    if (p.sourceConfiguration !== undefined) {
      base = { ...(p.sourceConfiguration as Record<string, unknown>) };
    }

    if (p.sourceType !== undefined) {
      sourceType = p.sourceType;
      if (p.sourceConfiguration === undefined) {
        base = mergeSourceConfigurationForSourceTypeChange(base, p.sourceType);
      }
    }
    if (p.destinationType !== undefined) {
      destinationType = p.destinationType;
    }
    if (p.canvas !== undefined) {
      if (p.canvas === null) {
        delete base.canvas;
      } else {
        base.canvas = { ...p.canvas, v: 1 };
      }
    }

    const tool: CreatePipelineBody["tool"] =
      existing.tool === "dlt" || existing.tool === "sling" ? existing.tool : "auto";
    const bodyMerged: CreatePipelineBody = {
      name: existing.name,
      sourceType,
      destinationType,
      tool,
      description: existing.description ?? undefined,
      groupName: existing.groupName ?? undefined,
      sourceConfiguration: base,
    };
    const { pipelineCode, configYaml, workspaceYaml } = generatePipelineArtifacts(bodyMerged);

    const row = await db.eltPipeline.update({
      where: { id: existing.id },
      data: {
        ...(p.enabled !== undefined ? { enabled: p.enabled } : {}),
        sourceType,
        destinationType,
        sourceConfiguration: base as object,
        pipelineCode,
        configYaml,
        workspaceYaml,
      },
    });

    return NextResponse.json({ pipeline: row });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
