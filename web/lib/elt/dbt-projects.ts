import type { DbtProject, EltPipeline } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { setDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import { generateDbtScaffoldFiles, scaffoldPackagePathForPipeline } from "@/lib/elt/dbt-scaffold";
import { defaultDbtRepoSubpath } from "@/lib/elt/eltpulse-repo-layout";

export type DbtProjectRow = DbtProject & {
  pipelines?: Pick<EltPipeline, "id" | "name" | "enabled" | "sourceType" | "destinationType">[];
};

export type DbtProjectSummary = {
  id: string;
  name: string;
  description: string | null;
  packagePath: string;
  gitUrl: string | null;
  gitBranch: string | null;
  gitSubpath: string | null;
  targetSchema: string | null;
  sourceSlug: string | null;
  hubPackageKey: string | null;
  runScope: string;
  selector: string | null;
  scheduleEnabled: boolean;
  cronSchedule: string | null;
  scheduleTimezone: string;
  destinationConnectionId: string | null;
  linkedPipelineIds: string[];
  linkedPipelines: { id: string; name: string; enabled: boolean; sourceType: string; destinationType: string }[];
  updatedAt: Date;
};

export function dbtTransformConfigFromProject(
  project: Pick<
    DbtProject,
    | "id"
    | "packagePath"
    | "gitUrl"
    | "gitBranch"
    | "gitSubpath"
    | "targetSchema"
    | "runScope"
    | "selector"
    | "scheduleEnabled"
    | "cronSchedule"
    | "scheduleTimezone"
    | "hubPackageKey"
  >
): Record<string, unknown> {
  const cfg: Record<string, unknown> = {
    enabled: true,
    project_id: project.id,
    package_path: project.packagePath,
    run_scope: project.runScope,
  };
  if (project.gitUrl) cfg.git_url = project.gitUrl;
  if (project.gitBranch) cfg.repository_branch = project.gitBranch;
  if (project.gitSubpath) cfg.git_subpath = project.gitSubpath;
  if (project.targetSchema) cfg.dataset_name = project.targetSchema;
  if (project.selector) cfg.selector = project.selector;
  if (project.scheduleEnabled) cfg.schedule_enabled = true;
  if (project.cronSchedule) cfg.cron_schedule = project.cronSchedule;
  if (project.scheduleTimezone) cfg.schedule_timezone = project.scheduleTimezone;
  if (project.hubPackageKey) cfg.hub_package = project.hubPackageKey;
  return cfg;
}

/** Merge linked dbt project config into pipeline sourceConfiguration (does not mutate input). */
export function mergeDbtProjectIntoSourceConfiguration(
  sourceConfiguration: unknown,
  project: DbtProject | null | undefined
): Record<string, unknown> {
  const base =
    sourceConfiguration && typeof sourceConfiguration === "object" && !Array.isArray(sourceConfiguration)
      ? { ...(sourceConfiguration as Record<string, unknown>) }
      : {};
  if (!project) return base;
  setDbtTransformConfig(base, dbtTransformConfigFromProject(project));
  return base;
}

export function resolveEffectiveSourceConfiguration(
  pipeline: Pick<EltPipeline, "sourceConfiguration">,
  dbtProject: DbtProject | null | undefined
): Record<string, unknown> {
  return mergeDbtProjectIntoSourceConfiguration(pipeline.sourceConfiguration, dbtProject);
}

/** Synthetic pipeline config for standalone dbt-only runs. */
export function sourceConfigurationFromDbtProject(
  project: Pick<
    DbtProject,
    | "packagePath"
    | "gitUrl"
    | "gitBranch"
    | "gitSubpath"
    | "targetSchema"
    | "runScope"
    | "selector"
    | "scheduleEnabled"
    | "cronSchedule"
    | "scheduleTimezone"
    | "hubPackageKey"
    | "id"
  >
): Record<string, unknown> {
  const base: Record<string, unknown> = {};
  setDbtTransformConfig(base, dbtTransformConfigFromProject(project));
  if (project.scheduleEnabled) base.schedule_enabled = true;
  if (project.cronSchedule) base.cron_schedule = project.cronSchedule;
  if (project.scheduleTimezone) base.schedule_timezone = project.scheduleTimezone;
  return base;
}

export function projectHasRunnableDbt(project: DbtProject): boolean {
  return Boolean(project.packagePath?.trim() || project.gitUrl?.trim());
}

export function toDbtProjectSummary(
  project: DbtProject & {
    pipelines?: Pick<EltPipeline, "id" | "name" | "enabled" | "sourceType" | "destinationType">[];
  }
): DbtProjectSummary {
  const linked = project.pipelines ?? [];
  return {
    id: project.id,
    name: project.name,
    description: project.description,
    packagePath: project.packagePath,
    gitUrl: project.gitUrl,
    gitBranch: project.gitBranch,
    gitSubpath: project.gitSubpath,
    targetSchema: project.targetSchema,
    sourceSlug: project.sourceSlug,
    hubPackageKey: project.hubPackageKey,
    runScope: project.runScope,
    selector: project.selector,
    scheduleEnabled: project.scheduleEnabled,
    cronSchedule: project.cronSchedule,
    scheduleTimezone: project.scheduleTimezone,
    destinationConnectionId: project.destinationConnectionId,
    linkedPipelineIds: linked.map((p) => p.id),
    linkedPipelines: linked.map((p) => ({
      id: p.id,
      name: p.name,
      enabled: p.enabled,
      sourceType: p.sourceType,
      destinationType: p.destinationType,
    })),
    updatedAt: project.updatedAt,
  };
}

export async function assertDbtProjectAccess(userId: string, projectId: string): Promise<DbtProject> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const row = await db.dbtProject.findFirst({
    where: { id: projectId, userId: { in: ownerIds } },
  });
  if (!row) throw new Error("Dbt project not found");
  return row;
}

export async function linkDbtProjectToPipeline(
  userId: string,
  projectId: string,
  pipelineId: string
): Promise<{ project: DbtProject; pipeline: EltPipeline }> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const [project, pipeline] = await Promise.all([
    db.dbtProject.findFirst({ where: { id: projectId, userId: { in: ownerIds } } }),
    db.eltPipeline.findFirst({ where: { id: pipelineId, userId: { in: ownerIds } } }),
  ]);
  if (!project) throw new Error("Dbt project not found");
  if (!pipeline) throw new Error("Pipeline not found");

  const sourceConfiguration = mergeDbtProjectIntoSourceConfiguration(pipeline.sourceConfiguration, project);
  const updated = await db.eltPipeline.update({
    where: { id: pipeline.id },
    data: {
      dbtProjectId: project.id,
      sourceConfiguration: sourceConfiguration as object,
    },
  });
  return { project, pipeline: updated };
}

export async function unlinkDbtProjectFromPipeline(userId: string, pipelineId: string): Promise<EltPipeline> {
  const ownerIds = await getAccessibleResourceOwnerIds(userId);
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: pipelineId, userId: { in: ownerIds } },
  });
  if (!pipeline) throw new Error("Pipeline not found");

  const sc = { ...(pipeline.sourceConfiguration as Record<string, unknown>) };
  delete sc.dbt;
  delete sc.dlt_dbt;

  return db.eltPipeline.update({
    where: { id: pipeline.id },
    data: {
      dbtProjectId: null,
      sourceConfiguration: sc as object,
    },
  });
}

export type CreateDbtProjectInput = {
  name: string;
  description?: string | null;
  packagePath: string;
  gitUrl?: string | null;
  gitBranch?: string | null;
  gitSubpath?: string | null;
  targetSchema?: string | null;
  sourceSlug?: string | null;
  hubPackageKey?: string | null;
  runScope?: string;
  selector?: string | null;
  destinationConnectionId?: string | null;
  pipelineId?: string | null;
  scaffoldFromHub?: boolean;
  /** When true, allow creating without gitUrl (configure Git on detail page). */
  draft?: boolean;
  /** Push hub scaffold to connected default GitHub repo on create. */
  scaffoldToDefaultRepo?: boolean;
  gitOwner?: string | null;
  gitRepo?: string | null;
};

/** @deprecated Use defaultDbtRepoSubpath — kept for callers expecting this name. */
export function defaultPackagePathForProjectName(name: string): string {
  return defaultDbtRepoSubpath(name);
}

function gitUrlFromOwnerRepo(owner?: string | null, repo?: string | null): string | null {
  const o = owner?.trim();
  const r = repo?.trim();
  if (!o || !r) return null;
  return `https://github.com/${o}/${r}`;
}

export async function createDbtProject(userId: string, input: CreateDbtProjectInput): Promise<DbtProject> {
  const sourceSlug = input.sourceSlug?.trim() || null;
  let hubPackageKey = input.hubPackageKey?.trim() || null;
  const gitUrl =
    input.gitUrl?.trim() ||
    gitUrlFromOwnerRepo(input.gitOwner, input.gitRepo) ||
    null;
  const gitBranch = input.gitBranch?.trim() || "main";
  let gitSubpath = input.gitSubpath?.trim() || null;

  let packagePath = input.packagePath.trim();
  if (!packagePath && gitUrl) {
    gitSubpath = gitSubpath || defaultDbtRepoSubpath(input.name);
    packagePath = gitSubpath;
  } else if (!packagePath && !gitUrl && input.draft) {
    packagePath = "";
  } else if (!packagePath) {
    gitSubpath = gitSubpath || defaultDbtRepoSubpath(input.name);
    packagePath = gitSubpath;
  }

  if (input.scaffoldFromHub && sourceSlug) {
    const hub = resolveDbtHubPackage(sourceSlug);
    if (hub) {
      hubPackageKey = hub.package;
    }
  }

  const project = await db.dbtProject.create({
    data: {
      userId,
      name: input.name.trim(),
      description: input.description?.trim() || null,
      packagePath,
      gitUrl,
      gitBranch,
      gitSubpath,
      targetSchema: input.targetSchema?.trim() || null,
      sourceSlug,
      hubPackageKey,
      runScope: input.runScope?.trim() || "all",
      selector: input.selector?.trim() || null,
      destinationConnectionId: input.destinationConnectionId ?? null,
    },
  });

  if (input.pipelineId) {
    await linkDbtProjectToPipeline(userId, project.id, input.pipelineId);
  }

  return project;
}

export function scaffoldFilesForDbtProject(name: string, sourceSlug: string) {
  const hub = resolveDbtHubPackage(sourceSlug);
  if (!hub) return null;
  return {
    hub,
    files: generateDbtScaffoldFiles(name, hub),
    packagePath: defaultDbtRepoSubpath(name),
  };
}

export async function loadDbtProjectForPipeline(
  pipeline: Pick<EltPipeline, "dbtProjectId" | "sourceConfiguration">
): Promise<DbtProject | null> {
  if (pipeline.dbtProjectId) {
    return db.dbtProject.findUnique({ where: { id: pipeline.dbtProjectId } });
  }
  const cfg = pipeline.sourceConfiguration as Record<string, unknown> | null;
  const dbt = cfg?.dbt ?? cfg?.dlt_dbt;
  if (dbt && typeof dbt === "object") {
    const pid = String((dbt as Record<string, unknown>).project_id ?? "").trim();
    if (pid) return db.dbtProject.findUnique({ where: { id: pid } });
  }
  return null;
}
