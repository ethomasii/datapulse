import type { MedallionLayer } from "@/lib/elt/declarative-pipeline-spec";

/** Vendor-neutral hint shown in lake starter dialogs and transform copy. */
export const WAREHOUSE_COMPUTE_HINT =
  "SQL compiles and runs on your connected warehouse — DuckDB, Postgres, Snowflake, BigQuery, Redshift, Databricks SQL, and more. No extra compute lock-in.";

export const LAKE_PIPELINE_TAGLINE =
  "Prototype transforms with recipes on the canvas — link a dbt project for production (tests, docs, git). Dataframe is legacy when SQL is not enough.";

export const MEDALLION_LAYER_EXPLAINER =
  "Bronze = landed ingest · Silver = cleansed & deduped · Gold = aggregated mart — all tables stay on the same destination.";

/** Best-effort default loaded table for lake starters from pipeline context. */
export function defaultSourceTable(opts?: {
  pipelineName?: string;
  schemaOverride?: string;
  fallback?: string;
}): string {
  if (opts?.fallback?.trim()) return opts.fallback.trim();
  const schema = opts?.schemaOverride?.trim() || "staging";
  const raw = opts?.pipelineName?.trim();
  const table = raw
    ? raw
        .replace(/[^a-zA-Z0-9_]/g, "_")
        .replace(/^_+|_+$/g, "")
        .toLowerCase() || "events"
    : "events";
  return `${schema}.${table}`;
}

export type MedallionHints = { landing: MedallionLayer; transform: MedallionLayer };

export function medallionHintsForStarter(starterId: string): MedallionHints | undefined {
  if (starterId === "single_lake_medallion") {
    return { landing: "bronze", transform: "gold" };
  }
  return undefined;
}

export const DEFAULT_LAKE_STARTER_ID = "single_source_to_mart";

/** Deep link to canvas with a lake starter recipe applied after ingest. */
export function canvasStarterHref(opts: {
  pipelineId: string;
  starterId?: string;
  pipelineName?: string;
  sourceTable?: string;
}): string {
  const starter = opts.starterId ?? DEFAULT_LAKE_STARTER_ID;
  const source_table =
    opts.sourceTable ?? defaultSourceTable({ pipelineName: opts.pipelineName, fallback: "staging.events" });
  const q = new URLSearchParams({
    pipeline: opts.pipelineId,
    starter,
    source_table,
  });
  return `/builder/canvas?${q.toString()}`;
}
