import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { generatePipelineArtifacts } from "@/lib/elt/generate-artifacts";
import type { CreatePipelineBody } from "@/lib/elt/types";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";

export type PipelineForExecutionRefresh = {
  id: string;
  name: string;
  tool: string;
  sourceType: string;
  destinationType: string;
  sourceConfiguration: unknown;
  pipelineCode: string;
  description?: string | null;
  groupName?: string | null;
};

function toArtifactBody(pipeline: PipelineForExecutionRefresh): CreatePipelineBody {
  return {
    name: pipeline.name,
    sourceType: pipeline.sourceType,
    destinationType: pipeline.destinationType,
    sourceConfiguration: (pipeline.sourceConfiguration ?? {}) as Record<string, unknown>,
    tool: pipeline.tool === "sling" ? "sling" : "dlt",
    description: pipeline.description ?? undefined,
    groupName: pipeline.groupName ?? undefined,
  };
}

/** Regenerate pipeline.py from the saved definition so codegen fixes apply without a manual re-save. */
export async function resolveExecutionPipelineCode(
  userId: string,
  pipeline: PipelineForExecutionRefresh
): Promise<string> {
  if (pipeline.tool !== "dlt" && pipeline.tool !== "sling") {
    return pipeline.pipelineCode;
  }
  try {
    const ownerIds = await getAccessibleResourceOwnerIds(userId);
    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(userId);
    const artifacts = await generatePipelineArtifacts(toArtifactBody(pipeline), {
      workspaceCatalogUrls,
      ownerIds,
    });
    return artifacts.pipelineCode;
  } catch (e) {
    console.warn("[resolveExecutionPipelineCode]", pipeline.id, e);
    return pipeline.pipelineCode;
  }
}

/** Persist freshly generated artifacts before a managed run (keeps stored code in sync with the builder). */
export async function refreshAndPersistPipelineArtifacts(userId: string, pipelineId: string): Promise<void> {
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId },
    select: {
      id: true,
      name: true,
      tool: true,
      sourceType: true,
      destinationType: true,
      sourceConfiguration: true,
      pipelineCode: true,
      description: true,
      groupName: true,
    },
  });
  if (!pipeline || (pipeline.tool !== "dlt" && pipeline.tool !== "sling")) return;

  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(userId);
  const artifacts = await generatePipelineArtifacts(toArtifactBody(pipeline), {
    workspaceCatalogUrls,
    ownerIds,
  });

  if (
    artifacts.pipelineCode === pipeline.pipelineCode
  ) {
    return;
  }

  await db.eltPipeline.update({
    where: { id: pipelineId },
    data: {
      pipelineCode: artifacts.pipelineCode,
      configYaml: artifacts.configYaml,
      workspaceYaml: artifacts.workspaceYaml,
    },
  });
}
