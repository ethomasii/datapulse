import type { EltPipeline } from "@prisma/client";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";
import { db } from "@/lib/db/client";
import { syncDltDbtWithCanvas } from "@/lib/elt/dbt-canvas";
import { generatePipelineArtifacts, resolveTool } from "@/lib/elt/generate-artifacts";
import { mergeEltMetadataIntoSourceConfig } from "@/lib/elt/merge-elt-metadata";
import { preparePipelinePersistenceAndArtifacts } from "@/lib/elt/pipeline-connection-fks";
import type { CreatePipelineBody } from "@/lib/elt/types";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";

export type PersistPipelineFailure = { ok: false; status: number; message: string };

export type PersistPipelineSuccess = {
  ok: true;
  pipeline: EltPipeline;
  created: boolean;
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
  const bodyMerged = { ...body, sourceConfiguration: mergedSourceConfiguration };
  const prepared = await preparePipelinePersistenceAndArtifacts(userId, bodyMerged, mergedSourceConfiguration);
  if (!prepared.ok) {
    return { ok: false, status: 400, message: prepared.message };
  }
  const bodyForArtifacts = prepared.artifactBody;
  const resolvedTool = resolveTool(bodyForArtifacts);
  const { pipelineCode, configYaml, workspaceYaml } = generatePipelineArtifacts(bodyForArtifacts);
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
  body: CreatePipelineBody
): Promise<PersistPipelineSuccess | PersistPipelineFailure> {
  const prep = await prepareWrite(userId, body);
  if (isPersistFailure(prep)) return prep;

  const gw = await resolveDefaultGateway(userId, body);
  if (isGatewayFailure(gw)) return gw;

  let runsWebhookUrl: string | null;
  try {
    runsWebhookUrl = normalizeRunWebhookUrl(prep.bodyMerged.runsWebhookUrl);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid webhook URL";
    return { ok: false, status: 400, message: msg };
  }

  const existing = await db.eltPipeline.findUnique({
    where: {
      userId_name_tool: {
        userId,
        name: prep.bodyForArtifacts.name,
        tool: prep.resolvedTool,
      },
    },
    select: { id: true },
  });

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
  };

  if (existing) {
    const pipeline = await db.eltPipeline.update({
      where: { id: existing.id },
      data,
    });
    return { ok: true, pipeline, created: false };
  }

  const pipeline = await db.eltPipeline.create({
    data: {
      userId,
      ...data,
    },
  });
  return { ok: true, pipeline, created: true };
}

/** Create only — fails with 409 if the same name+tool already exists. */
export async function createPipelineDefinition(
  userId: string,
  body: CreatePipelineBody
): Promise<PersistPipelineSuccess | PersistPipelineFailure> {
  const prep = await prepareWrite(userId, body);
  if (isPersistFailure(prep)) return prep;

  const dup = await db.eltPipeline.findUnique({
    where: {
      userId_name_tool: {
        userId,
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

  const gw = await resolveDefaultGateway(userId, body);
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
      userId,
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
    },
  });

  return { ok: true, pipeline, created: true };
}
