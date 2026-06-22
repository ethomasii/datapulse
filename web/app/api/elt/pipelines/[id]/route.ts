import { NextResponse } from "next/server";
import type { Edge, Node } from "@xyflow/react";
import { z } from "zod";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema, type CreatePipelineBody } from "@/lib/elt/types";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import {
  preparePipelinePersistenceAndArtifacts,
  stripLegacyPipelineConnectionKeys,
} from "@/lib/elt/pipeline-connection-fks";
import { validatePipelineCanvasGraph } from "@/lib/elt/validate-pipeline-canvas-graph";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";
import { mergeSourceConfigurationForSourceTypeChange } from "@/lib/elt/merge-source-config-on-type-change";
import { syncDltDbtWithCanvas } from "@/lib/elt/dbt-canvas";
import {
  extractComponentsFromCanvas,
  syncCanvasToPipelineSpec,
} from "@/lib/elt/canvas-component-sync";
import { applyCanvasSensorMonitors } from "@/lib/elt/apply-canvas-component-monitors";
import { linkDbtProjectToPipeline, unlinkDbtProjectFromPipeline } from "@/lib/elt/dbt-projects";
import { resolveRouteParamId } from "@/lib/server/route-params";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { assertCanWritePipelines } from "@/lib/auth/workspace-auth-helpers";
import { recordWorkspaceAuditEvent } from "@/lib/audit/workspace-audit";

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
    sourceConnectionId: z.union([z.string().min(1), z.null()]).optional(),
    destinationConnectionId: z.union([z.string().min(1), z.null()]).optional(),
    dbtProjectId: z.union([z.string().min(1), z.null()]).optional(),
  })
  .refine(
    (d) =>
      d.canvas !== undefined ||
      typeof d.enabled === "boolean" ||
      d.sourceType !== undefined ||
      d.destinationType !== undefined ||
      d.sourceConfiguration !== undefined ||
      d.defaultTargetAgentTokenId !== undefined ||
      d.executionHost !== undefined ||
      d.sourceConnectionId !== undefined ||
      d.destinationConnectionId !== undefined ||
      d.dbtProjectId !== undefined,
    { message: "No updatable fields" }
  );

type Ctx = { params: { id: string } | Promise<{ id: string }> };

export async function GET(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();
  const user = auth.user;
  const pipelineId = await resolveRouteParamId(ctx.params);
  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  try {
    const row = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
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

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const user = auth.user;
  const denied = await assertCanWritePipelines(user.id);
  if (denied) return denied;
  const pipelineId = await resolveRouteParamId(ctx.params);
  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
    select: { id: true, name: true, userId: true, tool: true },
  });
  if (!pipeline) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  await db.eltPipeline.deleteMany({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  await recordWorkspaceAuditEvent({
    userId: pipeline.userId,
    actorEmail: user.email,
    action: "pipeline.deleted",
    detail: { pipelineId: pipeline.id, name: pipeline.name, tool: pipeline.tool },
  });
  return NextResponse.json({ ok: true });
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const user = auth.user;
  const denied = await assertCanWritePipelines(user.id);
  if (denied) return denied;
  const pipelineId = await resolveRouteParamId(ctx.params);
  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
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
  const prepared = await preparePipelinePersistenceAndArtifacts(user.id, bodyMerged, mergedSourceConfiguration);
  if (!prepared.ok) {
    return NextResponse.json({ error: prepared.message }, { status: 400 });
  }
  const bodyForArtifacts = prepared.artifactBody;

  try {
    const existing = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
    });
    if (!existing) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
    }

    const resolvedTool = resolveTool(bodyForArtifacts);

    if (existing.name !== bodyForArtifacts.name || existing.tool !== resolvedTool) {
      const conflict = await db.eltPipeline.findUnique({
        where: {
          userId_name_tool: {
            userId: user.id,
            name: bodyForArtifacts.name,
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

    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(user.id);
    const { pipelineCode, configYaml, workspaceYaml } = await generatePipelineArtifacts(bodyForArtifacts, {
      workspaceCatalogUrls,
    });

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
        name: bodyForArtifacts.name,
        tool: resolvedTool,
        sourceType: bodyForArtifacts.sourceType,
        destinationType: bodyForArtifacts.destinationType,
        description: bodyForArtifacts.description ?? null,
        groupName: bodyForArtifacts.groupName ?? null,
        sourceConfiguration: prepared.persistedSourceConfiguration as object,
        sourceConnectionId: prepared.sourceConnectionId,
        destinationConnectionId: prepared.destinationConnectionId,
        pipelineCode,
        configYaml,
        workspaceYaml,
        ...(runsWebhookUrl !== undefined ? { runsWebhookUrl } : {}),
        ...(defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId } : {}),
        ...(body.executionHost !== undefined ? { executionHost: body.executionHost } : {}),
      },
    });

    if (body.dbtProjectId !== undefined) {
      if (body.dbtProjectId) {
        await linkDbtProjectToPipeline(user.id, body.dbtProjectId, row.id);
      } else {
        await unlinkDbtProjectFromPipeline(user.id, row.id);
      }
    }

    const refreshed = await db.eltPipeline.findUnique({ where: { id: row.id } });
    return NextResponse.json({ pipeline: refreshed ?? row });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function PATCH(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const user = auth.user;
  const denied = await assertCanWritePipelines(user.id);
  if (denied) return denied;
  const pipelineId = await resolveRouteParamId(ctx.params);
  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
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
    p.executionHost === undefined &&
    p.sourceConnectionId === undefined &&
    p.destinationConnectionId === undefined;

  const onlyDefaultGateway =
    p.defaultTargetAgentTokenId !== undefined &&
    p.executionHost === undefined &&
    p.canvas === undefined &&
    typeof p.enabled !== "boolean" &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined &&
    p.sourceConnectionId === undefined &&
    p.destinationConnectionId === undefined;

  const onlyExecutionHost =
    p.executionHost !== undefined &&
    p.defaultTargetAgentTokenId === undefined &&
    p.canvas === undefined &&
    typeof p.enabled !== "boolean" &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined &&
    p.sourceConnectionId === undefined &&
    p.destinationConnectionId === undefined;

  const onlyDbtProject =
    p.dbtProjectId !== undefined &&
    p.canvas === undefined &&
    typeof p.enabled !== "boolean" &&
    p.sourceType === undefined &&
    p.destinationType === undefined &&
    p.sourceConfiguration === undefined &&
    p.defaultTargetAgentTokenId === undefined &&
    p.executionHost === undefined &&
    p.sourceConnectionId === undefined &&
    p.destinationConnectionId === undefined;

  try {
    if (onlyDbtProject) {
      const existing = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: { in: ownerIds } },
      });
      if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
      if (p.dbtProjectId) {
        await linkDbtProjectToPipeline(user.id, p.dbtProjectId, existing.id);
      } else {
        await unlinkDbtProjectFromPipeline(user.id, existing.id);
      }
      const pipeline = await db.eltPipeline.findUnique({ where: { id: existing.id } });
      return NextResponse.json({ pipeline });
    }

    if (onlyExecutionHost) {
      const row = await db.eltPipeline.updateMany({
        where: { id: pipelineId, userId: { in: ownerIds } },
        data: { executionHost: p.executionHost },
      });
      if (row.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: { in: ownerIds } },
      });
      return NextResponse.json({ pipeline });
    }

    if (onlyDefaultGateway) {
      if (p.defaultTargetAgentTokenId === null) {
        const row = await db.eltPipeline.updateMany({
          where: { id: pipelineId, userId: { in: ownerIds } },
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
          where: { id: pipelineId, userId: { in: ownerIds } },
          data: { defaultTargetAgentTokenId: tokenId },
        });
        if (row.count === 0) {
          return NextResponse.json({ error: "Not found" }, { status: 404 });
        }
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: { in: ownerIds } },
      });
      return NextResponse.json({ pipeline });
    }

    if (onlyEnabled) {
      const row = await db.eltPipeline.updateMany({
        where: { id: pipelineId, userId: { in: ownerIds } },
        data: { enabled: p.enabled },
      });
      if (row.count === 0) {
        return NextResponse.json({ error: "Not found" }, { status: 404 });
      }
      const pipeline = await db.eltPipeline.findFirst({
        where: { id: pipelineId, userId: { in: ownerIds } },
      });
      return NextResponse.json({ pipeline });
    }

    const existing = await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
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

    let base = stripLegacyPipelineConnectionKeys({
      ...(existing.sourceConfiguration as Record<string, unknown>),
    });
    let sourceType = existing.sourceType;
    let destinationType = existing.destinationType;

    if (p.sourceConfiguration !== undefined) {
      base = stripLegacyPipelineConnectionKeys({
        ...(p.sourceConfiguration as Record<string, unknown>),
      });
    }

    if (p.sourceType !== undefined) {
      sourceType = p.sourceType;
      if (p.sourceConfiguration === undefined) {
        base = stripLegacyPipelineConnectionKeys(
          mergeSourceConfigurationForSourceTypeChange(base, p.sourceType)
        );
      }
    }
    if (p.destinationType !== undefined) {
      destinationType = p.destinationType;
    }

    let nextSourceConnectionId = existing.sourceConnectionId ?? null;
    let nextDestinationConnectionId = existing.destinationConnectionId ?? null;
    if (p.sourceConnectionId !== undefined) {
      nextSourceConnectionId = p.sourceConnectionId;
    } else if (p.sourceType !== undefined) {
      nextSourceConnectionId = null;
    }
    if (p.destinationConnectionId !== undefined) {
      nextDestinationConnectionId = p.destinationConnectionId;
    } else if (p.destinationType !== undefined) {
      nextDestinationConnectionId = null;
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

    let declarativeSpecYaml: string | undefined;
    let monitorApply: Awaited<ReturnType<typeof applyCanvasSensorMonitors>> | undefined;

    if (p.canvas !== undefined && p.canvas !== null) {
      const synced = await syncCanvasToPipelineSpec(existing, base);
      base = synced.sourceConfiguration;
      declarativeSpecYaml = synced.declarativeSpecYaml;

      const extracted = extractComponentsFromCanvas(
        p.canvas.nodes as Node[],
        p.canvas.edges as Edge[],
        { pipelineName: existing.name }
      );
      if (extracted.sensorMonitors.length) {
        monitorApply = await applyCanvasSensorMonitors(
          user.id,
          existing.id,
          nextSourceConnectionId,
          extracted.sensorMonitors
        );
      }
    }

    const tool: CreatePipelineBody["tool"] =
      existing.tool === "dlt" || existing.tool === "sling" ? existing.tool : "auto";
    const syntheticBody: CreatePipelineBody = {
      name: existing.name,
      sourceType,
      destinationType,
      tool,
      description: existing.description ?? undefined,
      groupName: existing.groupName ?? undefined,
      sourceConnectionId: nextSourceConnectionId,
      destinationConnectionId: nextDestinationConnectionId,
      sourceConfiguration: base,
    };
    const preparedPatch = await preparePipelinePersistenceAndArtifacts(user.id, syntheticBody, base);
    if (!preparedPatch.ok) {
      return NextResponse.json({ error: preparedPatch.message }, { status: 400 });
    }

    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(user.id);
    const { pipelineCode, configYaml, workspaceYaml } = await generatePipelineArtifacts(preparedPatch.artifactBody, {
      workspaceCatalogUrls,
    });

    const row = await db.eltPipeline.update({
      where: { id: existing.id },
      data: {
        ...(p.enabled !== undefined ? { enabled: p.enabled } : {}),
        sourceType,
        destinationType,
        sourceConnectionId: preparedPatch.sourceConnectionId,
        destinationConnectionId: preparedPatch.destinationConnectionId,
        sourceConfiguration: preparedPatch.persistedSourceConfiguration as object,
        pipelineCode,
        configYaml,
        workspaceYaml,
        ...(declarativeSpecYaml ? { declarativeSpecYaml } : {}),
        ...(nextDefaultGateway !== undefined ? { defaultTargetAgentTokenId: nextDefaultGateway } : {}),
        ...(p.executionHost !== undefined ? { executionHost: p.executionHost } : {}),
      },
    });

    if (p.dbtProjectId !== undefined) {
      if (p.dbtProjectId) {
        await linkDbtProjectToPipeline(user.id, p.dbtProjectId, row.id);
      } else {
        await unlinkDbtProjectFromPipeline(user.id, row.id);
      }
    }

    const refreshed = await db.eltPipeline.findUnique({ where: { id: row.id } });
    return NextResponse.json({
      pipeline: refreshed ?? row,
      ...(monitorApply ? { monitorApply } : {}),
    });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
