import type { PipelineDefinitionSource } from "@prisma/client";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { generatePipelineArtifacts } from "@/lib/elt/generate-artifacts";
import { parseAndCompileDeclarativeYaml, parsePipelineDeclarationYaml } from "@/lib/elt/parse-pipeline-declaration";
import { normalizePipelineRunEnvironment } from "@/lib/elt/pipeline-run-environment";
import type { PipelineForExecutionRefresh } from "@/lib/elt/refresh-pipeline-artifacts-for-execution";
import { resolveExecutionPipelineCode } from "@/lib/elt/refresh-pipeline-artifacts-for-execution";
import type { CreatePipelineBody } from "@/lib/elt/types";
import { loadWorkspaceCatalogUrls } from "@/lib/elt/workspace-catalog-sources";
import {
  getWorkspaceGithubSettings,
  resolveDefinitionSourceForEnvironment,
  resolveGitBranchForRunEnvironment,
} from "@/lib/elt/workspace-github";
import { ELTPULSE_REPO } from "@/lib/elt/eltpulse-repo-layout";
import {
  decodeGithubFileContent,
  githubJson,
  githubRepoContentsApiPath,
  type GithubContentFile,
} from "@/lib/integrations/github-rest";

export type ExecutionPipelineManifest = {
  pipelineCode: string;
  configYaml: string | null;
  workspaceYaml: string | null;
  sourceConfiguration?: unknown;
  definitionSource: PipelineDefinitionSource;
  gitRef?: string | null;
};

function toArtifactBody(
  pipeline: PipelineForExecutionRefresh,
  overrides?: Partial<CreatePipelineBody>
): CreatePipelineBody {
  return {
    name: pipeline.name,
    sourceType: overrides?.sourceType ?? pipeline.sourceType,
    destinationType: overrides?.destinationType ?? pipeline.destinationType,
    sourceConfiguration: (overrides?.sourceConfiguration ??
      pipeline.sourceConfiguration ??
      {}) as Record<string, unknown>,
    tool: pipeline.tool === "sling" ? "sling" : pipeline.tool === "dbt" ? "dbt" : "dlt",
    description: pipeline.description ?? undefined,
    groupName: pipeline.groupName ?? undefined,
  };
}

async function fetchPipelineYamlFromGit(
  token: string,
  repo: { owner: string; name: string },
  pipelineName: string,
  ref: string
): Promise<string | null> {
  const path = `${ELTPULSE_REPO.pipelinesDir}/${pipelineName}.yaml`;
  const fp = githubRepoContentsApiPath(repo.owner, repo.name, path, ref);
  const res = await githubJson<GithubContentFile>(token, fp);
  if (!res.ok || !res.json || res.json.encoding !== "base64") return null;
  return decodeGithubFileContent(res.json);
}

async function manifestFromGitYaml(
  actingUserId: string,
  pipeline: PipelineForExecutionRefresh,
  yamlText: string
): Promise<ExecutionPipelineManifest | null> {
  try {
    let body: CreatePipelineBody;
    try {
      const parsed = await parseAndCompileDeclarativeYaml(actingUserId, yamlText);
      body = parsed.body;
    } catch {
      body = parsePipelineDeclarationYaml(yamlText).body;
    }

    const ownerIds = await getAccessibleResourceOwnerIds(actingUserId);
    const workspaceCatalogUrls = await loadWorkspaceCatalogUrls(actingUserId);
    const artifacts = await generatePipelineArtifacts(toArtifactBody(pipeline, body), {
      workspaceCatalogUrls,
      ownerIds,
    });

    return {
      pipelineCode: artifacts.pipelineCode,
      configYaml: artifacts.configYaml,
      workspaceYaml: artifacts.workspaceYaml,
      sourceConfiguration: body.sourceConfiguration,
      definitionSource: "git",
    };
  } catch (e) {
    console.warn("[resolveExecutionPipelineManifest] git compile failed", pipeline.id, e);
    return null;
  }
}

/** Resolve pipeline artifacts for a run — Neon or Git branch per workspace settings. */
export async function resolveExecutionPipelineManifest(
  actingUserId: string,
  pipeline: PipelineForExecutionRefresh & {
    configYaml?: string | null;
    workspaceYaml?: string | null;
  },
  environment: string
): Promise<ExecutionPipelineManifest> {
  const env = normalizePipelineRunEnvironment(environment);
  const settings = await getWorkspaceGithubSettings(actingUserId);
  const definitionSource = settings
    ? resolveDefinitionSourceForEnvironment(settings, env)
    : "neon";

  if (definitionSource === "git" && settings?.token && settings.repo) {
    const gitRef = resolveGitBranchForRunEnvironment(settings, env);
    const yamlText = await fetchPipelineYamlFromGit(
      settings.token,
      settings.repo,
      pipeline.name,
      gitRef
    );
    if (yamlText) {
      const fromGit = await manifestFromGitYaml(actingUserId, pipeline, yamlText);
      if (fromGit) {
        return { ...fromGit, gitRef, definitionSource: "git" };
      }
    }
    console.warn(
      "[resolveExecutionPipelineManifest] git source configured but fetch/compile failed — falling back to Neon",
      pipeline.id,
      gitRef
    );
  }

  const pipelineCode = await resolveExecutionPipelineCode(actingUserId, {
    ...pipeline,
    pipelineCode: pipeline.pipelineCode ?? "",
  });

  return {
    pipelineCode,
    configYaml: pipeline.configYaml ?? null,
    workspaceYaml: pipeline.workspaceYaml ?? null,
    definitionSource: "neon",
    gitRef: null,
  };
}
