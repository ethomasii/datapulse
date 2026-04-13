import { NextResponse } from "next/server";
import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import { validatePipelineCanvasGraph } from "@/lib/elt/validate-pipeline-canvas-graph";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";
import { mergeSourceConfigurationForSourceTypeChange } from "@/lib/elt/merge-source-config-on-type-change";
import { syncDltDbtWithCanvas } from "@/lib/elt/dbt-canvas";
import { resolveRouteParamId } from "@/lib/server/route-params";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";

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
    defaultTargetAgentTokenId: z.union([z.string().min(1), z.null()]).optional(),
    executionHost: z.enum(["inherit", "eltpulse_managed", "customer_gateway"]).optional(),
  })
  .refine(
    (d) =>
      d.canvas !== undefined ||
      typeof d.enabled === "boolean" ||
      d.sourceType !== undefined ||
      d.destinationType !== undefined ||
      d.sourceConfiguration !== undefined ||
      d.defaultTargetAgentTokenId !== undefined ||
      d.executionHost !== undefined,
    { message: "No updatable fields" }
  );

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const pipelineId = await resolveRouteParamId(ctx.params);
  try {
    const row = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
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
  const pipelineId = await resolveRouteParamId(ctx.params);
  const res = await db.eltPipeline.deleteMany({
    where: { id: pipelineId, userId: user.id },
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
  const pipelineId = await resolveRouteParamId(ctx.params);
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
  syncDltDbtWithCanvas(mergedSourceConfiguration);
  const bodyMerged = { ...body, sourceConfiguration: mergedSourceConfiguration };

  try {
    const existing = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
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
        ...(defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId } : {}),
        ...(body.executionHost !== undefined ? { executionHost: body.executionHost } : {}),
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
  const pipelineId = await resolveRouteParamId(ctx.params);
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
    p.sourceConfiguration === undefined &&
    p.defaultTargetAgentTokenId === undefined &&
    p.executionHost === undefined;

  const onlyDefaultGateway =
    p.defaultTargetAgentTokenId !== undefined &&
    p.executionHost === undefined &&
    p.canvas === undefined &&
    typeof p.enabled !== "boolean" &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined;

  const onlyExecutionHost =
    p.executionHost !== undefined &&
    p.defaultTargetAgentTokenId === undefined &&
    p.canvas === undefined &&
    typeof p.enabled !== "boolean" &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined;

  try {
    if (onlyExecutionHost) {
      const row = await db.eltPipeline.updateMany({
        where: { id: pipelineId, userId: user.id },
        data: { executionHost: p.executionHost },
      });
      if (row.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: user.id },
      });
      return NextResponse.json({ pipeline });
    }

    if (onlyDefaultGateway) {
      if (p.defaultTargetAgentTokenId === null) {
        const row = await db.eltPipeline.updateMany({
          where: { id: pipelineId, userId: user.id },
          data: { defaultTargetAgentTokenId: null },
        });
        if (row.count === 0) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      } else {
        const tokenId = p.defaultTargetAgentTokenId;
        if (!tokenId) {
          return NextResponse.json({ error: "Invalid default gateway" }, { status: 400 });
        }
        try {
          await assertUserOwnsGatewayToken(user.id, tokenId);
        } catch {
          return NextResponse.json({ error: "Invalid default gateway" }, { status: 400 });
        }
        const row = await db.eltPipeline.updateMany({
          where: { id: pipelineId, userId: user.id },
          data: { defaultTargetAgentTokenId: tokenId },
        });
        if (row.count === 0) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: user.id },
      });
      return NextResponse.json({ pipeline });
    }

    if (onlyEnabled) {
      const row = await db.eltPipeline.updateMany({
        where: { id: pipelineId, userId: user.id },
        data: { enabled: p.enabled },
      });
      if (row.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: user.id },
      });
      return NextResponse.json({ pipeline });
    }

    const existing = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: user.id },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    let nextDefaultGateway: string | null | undefined;
    if (p.defaultTargetAgentTokenId !== undefined) {
      if (p.defaultTargetAgentTokenId === null) {
        nextDefaultGateway = null;
      } else {
        try {
          await assertUserOwnsGatewayToken(user.id, p.defaultTargetAgentTokenId);
          nextDefaultGateway = p.defaultTargetAgentTokenId;
        } catch {
          return NextResponse.json({ error: "Invalid default gateway" }, { status: 400 });
        }
      }
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
    if (p.canvas !== undefined && p.canvas !== null) {
      const { nodes: rawNodes, edges: rawEdges } = p.canvas;
      if (!Array.isArray(rawNodes) || !Array.isArray(rawEdges)) {
        return NextResponse.json(
          { error: "Invalid canvas: nodes and edges must be arrays" },
          { status: 400 }
        );
      }
      const canvasValidation = validatePipelineCanvasGraph(rawNodes as Node[], rawEdges as Edge[], {
        requireConnectorTypes: true,
        pipelineSourceType: sourceType,
        pipelineDestinationType: destinationType,
      });
      if (!canvasValidation.ok) {
        return NextResponse.json(
          { error: "Canvas validation failed", errors: canvasValidation.errors },
          { status: 400 }
        );
      }
    }
    if (p.canvas !== undefined) {
      if (p.canvas === null) {
        delete base.canvas;
      } else {
        base.canvas = { ...p.canvas, v: 1 };
      }
    }

    syncDltDbtWithCanvas(base);

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
        ...(nextDefaultGateway !== undefined ? { defaultTargetAgentTokenId: nextDefaultGateway } : {}),
        ...(p.executionHost !== undefined ? { executionHost: p.executionHost } : {}),
      },
    });

    return NextResponse.json({ pipeline: row });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
