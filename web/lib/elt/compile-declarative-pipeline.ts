import type { CreatePipelineBody } from "@/lib/elt/types";
import type {
  DeclarativePipelineSpec,
  MedallionLayer,
  PipelineComponentSpec,
} from "@/lib/elt/declarative-pipeline-spec";
import { defaultSyncModeForSource } from "@/lib/elt/sync-mode-defaults";
import { minimalSourceConfigurationForNewPipeline } from "@/lib/elt/minimal-source-configuration";
import {
  loadWorkspaceDefaults,
  resolveSpecDestination,
  resolveSpecSource,
  type WorkspaceDefaultsContext,
} from "@/lib/elt/workspace-default-destination";

export type CompileDeclarativeResult =
  | { ok: true; body: CreatePipelineBody; spec: DeclarativePipelineSpec }
  | { ok: false; error: string };

function applyTablesToSourceConfig(
  sourceType: string,
  tables: string[],
  config: Record<string, unknown>
): void {
  const slug = sourceType.toLowerCase();
  if (slug === "github") {
    config.resources = tables;
    return;
  }
  if (["postgres", "postgresql", "mysql", "mssql", "mongodb", "oracle"].includes(slug)) {
    config.tables = tables.join(",");
    return;
  }
  if (tables.length === 1) {
    config.resource_name = tables[0];
  }
  config.resources = tables;
  config.table_names = tables;
}

function applySyncToSourceConfig(
  sourceType: string,
  sync: NonNullable<DeclarativePipelineSpec["sync"]>,
  config: Record<string, unknown>
): void {
  const mode = sync.mode;
  if (mode === "full") {
    config.write_disposition = "replace";
    config.incremental = false;
    delete config.incremental_field;
    return;
  }
  config.incremental = true;
  const cursor = sync.cursor?.trim();
  if (cursor) {
    config.incremental_field = cursor;
    config.cursor_field = cursor;
  } else if (!config.incremental_field && !config.cursor_field) {
    const defaults = defaultSyncModeForSource(sourceType);
    if (typeof defaults.incremental_field === "string") {
      config.incremental_field = defaults.incremental_field;
    }
  }
  config.write_disposition =
    sync.writeDisposition ?? (mode === "merge" ? "merge" : "append");
}

function qualityChecksToTestLines(
  quality: NonNullable<DeclarativePipelineSpec["quality"]>
): string[] {
  const lines: string[] = [];
  for (const q of quality) {
    for (const col of q.not_null ?? []) {
      lines.push(`${q.table}.${col} not_null`);
    }
    for (const col of q.unique ?? []) {
      lines.push(`${q.table}.${col} unique`);
    }
  }
  return lines;
}

function applyTransformToSourceConfig(
  spec: DeclarativePipelineSpec,
  config: Record<string, unknown>
): void {
  const transform = spec.transform;
  const dbtFromComponent = spec.components?.find((c) => c.type === "dbt");

  const dbt = transform?.dbt;
  if (dbt?.enabled !== false && (dbt || dbtFromComponent)) {
    const cfg = dbtFromComponent?.config ?? {};
    const packagePath =
      dbt?.package_path ??
      dbt?.packagePath ??
      (typeof cfg.package_path === "string" ? cfg.package_path : undefined) ??
      (typeof cfg.packagePath === "string" ? cfg.packagePath : undefined);
    const selector =
      dbt?.select ??
      dbt?.selector ??
      (typeof cfg.select === "string" ? cfg.select : undefined) ??
      (typeof cfg.selector === "string" ? cfg.selector : undefined);

    config.dlt_dbt = {
      enabled: true,
      ...(packagePath ? { package_path: packagePath } : {}),
      ...(dbt?.dataset_name ?? dbt?.datasetName
        ? { dataset_name: dbt.dataset_name ?? dbt.datasetName }
        : {}),
      ...(dbt?.repository_branch ?? dbt?.repositoryBranch
        ? { repository_branch: dbt.repository_branch ?? dbt.repositoryBranch }
        : {}),
      run_scope:
        dbt?.run_scope ??
        dbt?.runScope ??
        (selector ? "selection" : "all"),
      ...(selector ? { selector } : {}),
    };
  }

  const postType = transform?.post_transform_type ?? transform?.postTransformType;
  if (postType) {
    config.post_transform_type = postType;
  }
}

function applyComponentsToSourceConfig(
  components: PipelineComponentSpec[],
  config: Record<string, unknown>
): void {
  config.elt_components = components;

  const qualityComponents = components.filter((c) => c.type === "quality");
  if (qualityComponents.length) {
    const existing = Array.isArray(config.elt_tests) ? [...config.elt_tests] : [];
    for (const comp of qualityComponents) {
      const table = String(comp.config.table ?? "");
      const notNull = comp.config.not_null;
      if (table && Array.isArray(notNull)) {
        for (const col of notNull) {
          existing.push(`${table}.${String(col)} not_null`);
        }
      }
    }
    if (existing.length) config.elt_tests = existing;
  }
}

function applyMedallionToSourceConfig(
  medallion: NonNullable<DeclarativePipelineSpec["medallion"]>,
  config: Record<string, unknown>
): void {
  config.elt_medallion = {
    landing: medallion.landing,
    transform: medallion.transform,
  };
}

function specNeedsWorkspaceDefaults(spec: DeclarativePipelineSpec): boolean {
  const dest = spec.destination.trim().toLowerCase();
  return dest === "@workspace" || dest === "@default" || dest === "default";
}

/**
 * Compile declarative pipeline spec v2 into the legacy {@link CreatePipelineBody}
 * consumed by codegen and persistence.
 */
export async function compileDeclarativePipelineSpec(
  userId: string,
  spec: DeclarativePipelineSpec,
  defaultsOverride?: WorkspaceDefaultsContext
): Promise<CompileDeclarativeResult> {
  const defaults =
    defaultsOverride ??
    (specNeedsWorkspaceDefaults(spec)
      ? await loadWorkspaceDefaults(userId)
      : {
          defaultDestinationConnectionId: null,
          defaultDestinationConnector: null,
          defaultDestinationName: null,
        });

  const sourceRes = await resolveSpecSource(userId, spec);
  if ("error" in sourceRes) return { ok: false, error: sourceRes.error };

  const destRes = await resolveSpecDestination(userId, spec, defaults);
  if ("error" in destRes) return { ok: false, error: destRes.error };

  const sourceConfiguration: Record<string, unknown> = {
    ...minimalSourceConfigurationForNewPipeline(sourceRes.sourceType),
    ...(spec.sourceOptions ?? {}),
  };

  if (spec.tables?.length) {
    applyTablesToSourceConfig(sourceRes.sourceType, spec.tables, sourceConfiguration);
  }

  if (spec.sync) {
    applySyncToSourceConfig(sourceRes.sourceType, spec.sync, sourceConfiguration);
  }

  if (spec.slices) {
    sourceConfiguration._partitionConfig = {
      type: spec.slices.granularity === "key" ? "key" : "date",
      column: spec.slices.column,
    };
  }

  applyTransformToSourceConfig(spec, sourceConfiguration);

  if (spec.quality?.length) {
    const lines = qualityChecksToTestLines(spec.quality);
    if (lines.length) sourceConfiguration.elt_tests = lines;
  }

  if (spec.components?.length) {
    applyComponentsToSourceConfig(spec.components, sourceConfiguration);
  }

  if (spec.medallion) {
    applyMedallionToSourceConfig(spec.medallion, sourceConfiguration);
  }

  const body: CreatePipelineBody = {
    name: spec.name,
    sourceType: sourceRes.sourceType,
    destinationType: destRes.destinationType,
    tool: spec.tool,
    description: spec.description,
    groupName: spec.groupName,
    sourceConfiguration,
    sourceConnectionId: sourceRes.sourceConnectionId,
    destinationConnectionId: destRes.destinationConnectionId,
    executionHost: spec.executionHost,
    runsWebhookUrl: spec.runsWebhookUrl,
    defaultTargetAgentTokenId: spec.defaultTargetAgentTokenId,
    dbtProjectId: spec.dbtProjectId,
    tests: spec.tests,
    sensors: spec.sensors,
    otherNotes: spec.otherNotes,
    sliceIntent: spec.slices ? "sliced" : undefined,
    partitionsNote: spec.slices?.note,
    scheduleEnabled: spec.schedule?.enabled,
    scheduleCron: spec.schedule?.cron,
    scheduleTimezone: spec.schedule?.timezone,
  };

  return { ok: true, body, spec };
}

/** Read medallion layer hints persisted on a pipeline row. */
export function readMedallionHints(sourceConfiguration: unknown): {
  landing: MedallionLayer;
  transform: MedallionLayer;
} {
  const cfg = sourceConfiguration as Record<string, unknown> | null;
  const raw = cfg?.elt_medallion;
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) {
    return { landing: "bronze", transform: "gold" };
  }
  const m = raw as Record<string, unknown>;
  const landing = m.landing === "silver" || m.landing === "gold" ? m.landing : "bronze";
  const transform = m.transform === "bronze" || m.transform === "silver" ? m.transform : "gold";
  return { landing, transform };
}
