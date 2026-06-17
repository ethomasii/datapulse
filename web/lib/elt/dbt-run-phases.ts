/** Run phase helpers for load → dbt transform orchestration (v2). */

export const RUN_PHASE_LABELS: Record<string, string> = {
  extract: "Extract",
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
  if (!sourceConfiguration || typeof sourceConfiguration !== "object") return false;
  const dbt = (sourceConfiguration as Record<string, unknown>).dlt_dbt;
  if (!dbt || typeof dbt !== "object") return false;
  const d = dbt as Record<string, unknown>;
  return Boolean(d.enabled) && String(d.package_path ?? "").trim().length > 0;
}

export function dbtPackagePathFromConfig(sourceConfiguration: unknown): string | null {
  if (!pipelineHasDbtEnabled(sourceConfiguration)) return null;
  const dbt = (sourceConfiguration as Record<string, unknown>).dlt_dbt as Record<string, unknown>;
  const path = String(dbt.package_path ?? "").trim();
  return path || null;
}
