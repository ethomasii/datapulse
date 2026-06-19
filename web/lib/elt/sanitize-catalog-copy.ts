/** Display-only cleanup for bundled external catalog descriptions (no vendor names in UI). */
export function sanitizeCatalogDescription(description: string): string {
  return description
    .replace(/\bdagster-airbyte\b/gi, "connector sync")
    .replace(/\bdagster-airflow\b/gi, "workflow bridge")
    .replace(/\bdagster-airlift\b/gi, "orchestration bridge")
    .replace(/\bDagster\b/g, "pipeline")
    .replace(/\bdagster\b/g, "pipeline")
    .replace(/\s{2,}/g, " ")
    .trim();
}
