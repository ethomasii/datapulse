/** Display label for a run when pipeline may be absent (standalone dbt). */
export function runSubjectLabel(run: {
  pipeline?: { name: string } | null;
  dbtProject?: { name: string } | null;
}): string {
  if (run.pipeline?.name) return run.pipeline.name;
  if (run.dbtProject?.name) return `dbt: ${run.dbtProject.name}`;
  return "Run";
}
