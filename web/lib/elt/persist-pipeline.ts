import type { EltPipeline } from "@prisma/client";
import { assertCanCreatePipeline } from "@/lib/plans/limits";
import { getWorkspacePermissions, workspaceResourceUserId } from "@/lib/auth/org-permissions";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";
import { db } from "@/lib/db/client";
import { syncDltDbtWithCanvas, syncPostTransformWithCanvas } from "@/lib/elt/dbt-canvas";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import { preparePipelinePersistenceAndArtifacts } from "@/lib/elt/pipeline-connection-fks";
import type { CreatePipelineBody } from "@/lib/elt/types";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";
import { maybeAutoPushPipelineToGit } from "@/lib/integrations/github-push-pipeline";
import { recordWorkspaceAuditForUser } from "@/lib/audit/workspace-audit";

export type PersistPipelineFailure = { ok: false; status: number; message: string };

export type PersistPipelineSuccess = {
  ok: true;
  pipeline: EltPipeline;
  created: boolean;
};

export type PersistPipelineOptions = {
  /** Store authoritative v2 declarative YAML on the pipeline row. */
  declarativeSpecYaml?: string | null;
};

type PreparedPipelineWrite = {
  bodyMerged: CreatePipelineBody;
  bodyForArtifacts: CreatePipelineBody;
  prepared: Extract<
    Awaited<ReturnType<typeof preparePipelinePersistenceAndArtifacts>>,
    { ok: true }
  >;
  resolvedTool: ReturnType<typeof resolveTool>;
  pipelineCode: string;
  configYaml: string;
  workspaceYaml: string;
};

async function prepareWrite(
  userId: string,
  body: CreatePipelineBody
): Promise<PersistPipelineFailure | PreparedPipelineWrite> {
  const mergedSourceConfiguration = mergeEltMetadataIntoSourceConfig(body);
  syncDltDbtWithCanvas(mergedSourceConfiguration);
  syncPostTransformWithCanvas(mergedSourceConfiguration);
  const bodyMerged = { ...body, sourceConfiguration: mergedSourceConfiguration };
  const prepared = await preparePipelinePersistenceAndArtifacts(userId, bodyMerged, mergedSourceConfiguration);
  if (!prepared.ok) {
    return { ok: false, status: 400, message: prepared.message };
  }
  const bodyForArtifacts = prepared.artifactBody;
  const resolvedTool = resolveTool(bodyForArtifacts);
  const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(userId);
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const { pipelineCode, configYaml, workspaceYaml } = await generatePipelineArtifacts(bodyForArtifacts, {
    workspaceCatalogUrls,
    ownerIds,
  });
  return {
    bodyMerged,
    bodyForArtifacts,
    prepared,
    resolvedTool,
    pipelineCode,
    configYaml,
    workspaceYaml,
  };
}

function isPersistFailure(
  r: PersistPipelineFailure | PreparedPipelineWrite
): r is PersistPipelineFailure {
  return "ok" in r && r.ok === false;
}

async function resolveDefaultGateway(
  userId: string,
  body: CreatePipelineBody
): Promise<PersistPipelineFailure | { defaultTargetAgentTokenId: string | null | undefined }> {
  let defaultTargetAgentTokenId: string | null | undefined;
  if (body.defaultTargetAgentTokenId !== undefined) {
    if (body.defaultTargetAgentTokenId === null) {
      defaultTargetAgentTokenId = null;
    } else {
      try {
        await assertUserOwnsGatewayToken(userId, body.defaultTargetAgentTokenId);
        defaultTargetAgentTokenId = body.defaultTargetAgentTokenId;
      } catch {
        return { ok: false, status: 400, message: "Invalid default gateway" };
      }
    }
  }
  return { defaultTargetAgentTokenId };
}

function isGatewayFailure(
  r: PersistPipelineFailure | { defaultTargetAgentTokenId: string | null | undefined }
): r is PersistPipelineFailure {
  return "ok" in r && r.ok === false;
}

/**
 * Create a pipeline row or replace the existing row with the same `name` + resolved `tool` (GitOps / YAML apply).
 */
export async function upsertPipelineDefinition(
  userId: string,
  body: CreatePipelineBody,
  options?: PersistPipelineOptions
): Promise<PersistPipelineSuccess | PersistPipelineFailure> {
  const perms = await getWorkspacePermissions(userId);
  if (!perms.canWrite) {
    return { ok: false, status: 403, message: "View-only access — you cannot create pipelines." };
  }
  const resourceUserId = workspaceResourceUserId(perms, userId);

  const prep = await prepareWrite(resourceUserId, body);
  if (isPersistFailure(prep)) return prep;

  const existing = await db.eltPipeline.findUnique({
    where: {
      userId_name_tool: {
        userId: resourceUserId,
        name: prep.bodyForArtifacts.name,
        tool: prep.resolvedTool,
      },
    },
    select: { id: true },
  });

  if (!existing) {
    const account = await db.user.findUnique({
      where: { id: resourceUserId },
      select: { subscription: { select: { tier: true } } },
    });
    const tier = account?.subscription?.tier ?? "free";
    const limitMsg = await assertCanCreatePipeline(resourceUserId, tier);
    if (limitMsg) return { ok: false, status: 403, message: limitMsg };
  }

  const gw = await resolveDefaultGateway(resourceUserId, body);
  if (isGatewayFailure(gw)) return gw;

  let runsWebhookUrl: string | null;
  try {
    runsWebhookUrl = normalizeRunWebhookUrl(prep.bodyMerged.runsWebhookUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid webhook URL";
    return { ok: false, status: 400, message: msg };
  }

  const data = {
    name: prep.bodyForArtifacts.name,
    tool: prep.resolvedTool,
    sourceType: prep.bodyForArtifacts.sourceType,
    destinationType: prep.bodyForArtifacts.destinationType,
    description: prep.bodyForArtifacts.description ?? null,
    groupName: prep.bodyForArtifacts.groupName ?? null,
    sourceConfiguration: prep.prepared.persistedSourceConfiguration as object,
    sourceConnectionId: prep.prepared.sourceConnectionId,
    destinationConnectionId: prep.prepared.destinationConnectionId,
    pipelineCode: prep.pipelineCode,
    configYaml: prep.configYaml,
    workspaceYaml: prep.workspaceYaml,
    runsWebhookUrl,
    ...(gw.defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId: gw.defaultTargetAgentTokenId } : {}),
    ...(body.executionHost !== undefined ? { executionHost: body.executionHost } : {}),
    ...(options?.declarativeSpecYaml !== undefined
      ? { declarativeSpecYaml: options.declarativeSpecYaml }
      : {}),
  };

  if (existing) {
    const pipeline = await db.eltPipeline.update({
      where: { id: existing.id },
      data,
    });
    void maybeAutoPushPipelineToGit(resourceUserId, pipeline.id);
    void recordWorkspaceAuditForUser({
      userId: resourceUserId,
      action: "pipeline.updated",
      detail: { pipelineId: pipeline.id, name: pipeline.name, tool: pipeline.tool },
    });
    return { ok: true, pipeline, created: false };
  }

  const pipeline = await db.eltPipeline.create({
    data: {
      userId: resourceUserId,
      ...data,
    },
  });
  void maybeAutoPushPipelineToGit(resourceUserId, pipeline.id);
  void recordWorkspaceAuditForUser({
    userId: resourceUserId,
    action: "pipeline.created",
    detail: { pipelineId: pipeline.id, name: pipeline.name, tool: pipeline.tool },
  });
  return { ok: true, pipeline, created: true };
}

/** Create only — fails with 409 if the same name+tool already exists. */
export async function createPipelineDefinition(
  userId: string,
  body: CreatePipelineBody,
  options?: PersistPipelineOptions
): Promise<PersistPipelineSuccess | PersistPipelineFailure> {
  const perms = await getWorkspacePermissions(userId);
  if (!perms.canWrite) {
    return { ok: false, status: 403, message: "View-only access — you cannot create pipelines." };
  }
  const resourceUserId = workspaceResourceUserId(perms, userId);
  const account = await db.user.findUnique({
    where: { id: resourceUserId },
    select: { subscription: { select: { tier: true } } },
  });
  const tier = account?.subscription?.tier ?? "free";
  const limitMsg = await assertCanCreatePipeline(resourceUserId, tier);
  if (limitMsg) return { ok: false, status: 403, message: limitMsg };

  const prep = await prepareWrite(resourceUserId, body);
  if (isPersistFailure(prep)) return prep;

  const dup = await db.eltPipeline.findUnique({
    where: {
      userId_name_tool: {
        userId: resourceUserId,
        name: prep.bodyForArtifacts.name,
        tool: prep.resolvedTool,
      },
    },
    select: { id: true },
  });
  if (dup) {
    return {
      ok: false,
      status: 409,
      message: `A pipeline named "${prep.bodyForArtifacts.name}" already exists for tool "${prep.resolvedTool}".`,
    };
  }

  const gw = await resolveDefaultGateway(resourceUserId, body);
  if (isGatewayFailure(gw)) return gw;

  let runsWebhookUrl: string | null;
  try {
    runsWebhookUrl = normalizeRunWebhookUrl(prep.bodyMerged.runsWebhookUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid webhook URL";
    return { ok: false, status: 400, message: msg };
  }

  const pipeline = await db.eltPipeline.create({
    data: {
      userId: resourceUserId,
      name: prep.bodyForArtifacts.name,
      tool: prep.resolvedTool,
      sourceType: prep.bodyForArtifacts.sourceType,
      destinationType: prep.bodyForArtifacts.destinationType,
      description: prep.bodyForArtifacts.description ?? null,
      groupName: prep.bodyForArtifacts.groupName ?? null,
      sourceConfiguration: prep.prepared.persistedSourceConfiguration as object,
      sourceConnectionId: prep.prepared.sourceConnectionId,
      destinationConnectionId: prep.prepared.destinationConnectionId,
      pipelineCode: prep.pipelineCode,
      configYaml: prep.configYaml,
      workspaceYaml: prep.workspaceYaml,
      runsWebhookUrl,
      ...(gw.defaultTargetAgentTokenId !== undefined ? { defaultTargetAgentTokenId: gw.defaultTargetAgentTokenId } : {}),
      ...(body.executionHost !== undefined ? { executionHost: body.executionHost } : {}),
      ...(options?.declarativeSpecYaml !== undefined
        ? { declarativeSpecYaml: options.declarativeSpecYaml }
        : {}),
    },
  });

  void maybeAutoPushPipelineToGit(userId, pipeline.id);
  void recordWorkspaceAuditForUser({
    userId: resourceUserId,
    action: "pipeline.created",
    detail: { pipelineId: pipeline.id, name: pipeline.name, tool: pipeline.tool },
  });

  return { ok: true, pipeline, created: true };
}
