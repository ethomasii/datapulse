/** Run phase helpers for load → dbt transform orchestration (v2+). */

export function readDbtTransformConfig(sourceConfiguration: unknown): Record<string, unknown> | null {
  if (!sourceConfiguration || typeof sourceConfiguration !== "object") return null;
  const sc = sourceConfiguration as Record<string, unknown>;
  const raw = sc.dbt ?? sc.dlt_dbt;
  if (!raw || typeof raw !== "object") return null;
  return raw as Record<string, unknown>;
}

export function setDbtTransformConfig(
  base: Record<string, unknown>,
  value: Record<string, unknown> | undefined
): void {
  delete base.dlt_dbt;
  if (value === undefined) delete base.dbt;
  else base.dbt = value;
}

export const RUN_PHASE_LABELS: Record<string, string> = {
  extract: "Sync",
  load: "Load",
  dbt: "dbt transform",
  transform: "dbt transform",
  done: "Complete",
  failed: "Failed",
};

export function formatRunPhaseLabel(phase: string | undefined | null): string {
  if (!phase) return "—";
  const key = phase.toLowerCase().trim();
  return RUN_PHASE_LABELS[key] ?? phase;
}

export function pipelineHasDbtEnabled(sourceConfiguration: unknown): boolean {
  const dbt = readDbtTransformConfig(sourceConfiguration);
  if (!dbt) return false;
  const hasPath = String(dbt.package_path ?? "").trim().length > 0;
  const hasGit = String(dbt.git_url ?? "").trim().length > 0;
  return Boolean(dbt.enabled) && (hasPath || hasGit);
}

export function dbtPackagePathFromConfig(sourceConfiguration: unknown): string | null {
  const dbt = readDbtTransformConfig(sourceConfiguration);
  if (!dbt || !pipelineHasDbtEnabled(sourceConfiguration)) return null;
  const path = String(dbt.package_path ?? "").trim();
  return path || null;
}

export type PipelineScheduleInfo = {
  enabled: boolean;
  cron: string | null;
  timezone: string;
};

export type DbtScheduleInfo = {
  enabled: boolean;
  cron: string | null;
  timezone: string;
  /** dbt-only run vs bundled after sync in the same run */
  mode: "dbt_only" | "post_sync";
};

export function readPipelineScheduleInfo(sourceConfiguration: unknown): PipelineScheduleInfo {
  const cfg =
    sourceConfiguration && typeof sourceConfiguration === "object"
      ? (sourceConfiguration as Record<string, unknown>)
      : {};
  const enabled = Boolean(cfg.schedule_enabled ?? cfg.scheduleEnabled);
  const cron = typeof cfg.cron_schedule === "string" && cfg.cron_schedule.trim() ? cfg.cron_schedule.trim() : null;
  const timezone =
    typeof cfg.schedule_timezone === "string" && cfg.schedule_timezone.trim()
      ? cfg.schedule_timezone.trim()
      : "UTC";
  return { enabled, cron, timezone };
}

export function readDbtScheduleInfo(sourceConfiguration: unknown): DbtScheduleInfo | null {
  if (!pipelineHasDbtEnabled(sourceConfiguration)) return null;
  const dbt = readDbtTransformConfig(sourceConfiguration)!;
  const pipeline = readPipelineScheduleInfo(sourceConfiguration);
  const enabled = Boolean(dbt.schedule_enabled ?? dbt.scheduleEnabled);
  const cron =
    typeof dbt.cron_schedule === "string" && dbt.cron_schedule.trim()
      ? dbt.cron_schedule.trim()
      : null;
  const timezone =
    typeof dbt.schedule_timezone === "string" && dbt.schedule_timezone.trim()
      ? dbt.schedule_timezone.trim()
      : pipeline.timezone;
  const modeRaw = String(dbt.schedule_mode ?? "dbt_only").toLowerCase();
  const mode: DbtScheduleInfo["mode"] = modeRaw === "post_sync" ? "post_sync" : "dbt_only";
  return { enabled, cron, timezone, mode };
}

export type ScheduleRunPhase = "extract" | "load" | "dbt";

/** Phases executed for a run based on how it was triggered. */
export function resolveRunPhasesForTrigger(
  sourceConfiguration: unknown,
  triggeredBy: string | null | undefined
): ScheduleRunPhase[] {
  const tb = triggeredBy?.trim() ?? "";
  if (isDbtOnlyTriggeredBy(tb)) return ["dbt"];
  if (tb.startsWith("ui:dbt_compile")) return ["dbt"];
  if (pipelineHasDbtEnabled(sourceConfiguration)) return ["extract", "load", "dbt"];
  return ["extract", "load"];
}

export function isDbtOnlyTriggeredBy(triggeredBy: string | null | undefined): boolean {
  const tb = triggeredBy?.trim() ?? "";
  if (!tb) return false;
  return (
    tb === "schedule:dbt" ||
    tb.startsWith("schedule:dbt:") ||
    tb === "ui:dbt_run" ||
    tb === "ui:dbt_test" ||
    (tb.startsWith("ui:dbt_") && !tb.startsWith("ui:dbt_compile"))
  );
}

export function dbtUiActionFromTriggeredBy(triggeredBy: string | null | undefined): "run" | "compile" | "test" | null {
  const tb = triggeredBy?.trim() ?? "";
  if (tb === "ui:dbt_compile" || tb.startsWith("ui:dbt_compile:")) return "compile";
  if (tb === "ui:dbt_test" || tb.startsWith("ui:dbt_test:")) return "test";
  if (tb === "ui:dbt_run" || tb.startsWith("ui:dbt_run:") || tb === "schedule:dbt") return "run";
  return null;
}
