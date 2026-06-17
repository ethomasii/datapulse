/** Run phase helpers for load → dbt transform orchestration (v2). */

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
  return Boolean(dbt.enabled) && String(dbt.package_path ?? "").trim().length > 0;
}

export function dbtPackagePathFromConfig(sourceConfiguration: unknown): string | null {
  const dbt = readDbtTransformConfig(sourceConfiguration);
  if (!dbt || !pipelineHasDbtEnabled(sourceConfiguration)) return null;
  const path = String(dbt.package_path ?? "").trim();
  return path || null;
}
