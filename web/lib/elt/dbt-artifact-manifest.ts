/**
 * Parse dbt artifact manifest.json (subset) into eltPulse DbtRunManifest model details.
 */

import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import { sanitizeDbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import { parseDbtManifestDependencies, parseDbtManifestColumnLineage } from "@/lib/elt/dbt-manifest-lineage";

type DbtManifestNode = {
  name?: string;
  description?: string;
  columns?: Record<string, { name?: string; description?: string; data_type?: string }>;
};

/** Merge schema/column metadata from dbt manifest.json nodes into an existing run manifest. */
export function enrichDbtManifestFromArtifact(
  manifest: DbtRunManifest,
  artifactRaw: unknown
): DbtRunManifest {
  if (!artifactRaw || typeof artifactRaw !== "object" || Array.isArray(artifactRaw)) return manifest;
  const nodes = (artifactRaw as { nodes?: Record<string, DbtManifestNode> }).nodes;
  if (!nodes) return manifest;

  const nodeByName = new Map<string, DbtManifestNode>();
  for (const node of Object.values(nodes)) {
    if (node?.name) nodeByName.set(node.name.toLowerCase(), node);
  }

  const models = manifest.models.map((m) => {
    const node = nodeByName.get(m.name.toLowerCase());
    if (!node) return m;
    const columns = node.columns
      ? Object.values(node.columns).map((c) => ({
          name: String(c.name ?? ""),
          type: c.data_type,
          description: c.description,
        })).filter((c) => c.name)
      : undefined;
    return {
      ...m,
      description: m.description ?? (node.description?.trim() || undefined),
      columns: m.columns?.length ? m.columns : columns,
    };
  });

  const deps = parseDbtManifestDependencies(artifactRaw);
  const columnLineage = parseDbtManifestColumnLineage(artifactRaw);

  return {
    ...manifest,
    models,
    ...(Object.keys(deps).length ? { modelDependencies: deps } : {}),
    ...(Object.keys(columnLineage).length ? { columnLineage } : {}),
  };
}

/** Build manifest from dbt run_results.json + optional manifest.json artifact. */
export function parseDbtRunArtifacts(
  runResultsRaw: unknown,
  manifestRaw?: unknown
): DbtRunManifest | null {
  if (!runResultsRaw || typeof runResultsRaw !== "object" || Array.isArray(runResultsRaw)) return null;
  const rr = runResultsRaw as {
    results?: { unique_id?: string; status?: string; execution_time?: number }[];
    metadata?: { dbt_schema_version?: string };
  };

  const models: DbtRunManifest["models"] = [];
  const tests: DbtRunManifest["tests"] = [];

  for (const r of rr.results ?? []) {
    const uid = String(r.unique_id ?? "");
    const short = uid.split(".").pop() ?? uid;
    const statusRaw = String(r.status ?? "").toLowerCase();
    const isTest = uid.startsWith("test.");
    if (isTest) {
      tests.push({
        name: short,
        status: statusRaw === "pass" ? "pass" : statusRaw === "warn" ? "warn" : statusRaw === "skipped" ? "skipped" : "fail",
      });
    } else if (uid.startsWith("model.")) {
      models.push({
        name: short,
        status: statusRaw === "success" ? "success" : statusRaw === "skipped" ? "skipped" : "error",
        executionTimeMs: typeof r.execution_time === "number" ? Math.round(r.execution_time * 1000) : undefined,
      });
    }
  }

  const base = sanitizeDbtRunManifest({
    models,
    tests,
    source: "runner",
    recordedAt: new Date().toISOString(),
  });
  if (!base) return null;
  if (!manifestRaw) return base;
  const enriched = enrichDbtManifestFromArtifact(base, manifestRaw);
  const deps = parseDbtManifestDependencies(manifestRaw);
  const columnLineage = parseDbtManifestColumnLineage(manifestRaw);
  if (Object.keys(deps).length === 0 && Object.keys(columnLineage).length === 0) return enriched;
  return {
    ...enriched,
    ...(Object.keys(deps).length ? { modelDependencies: deps } : {}),
    ...(Object.keys(columnLineage).length ? { columnLineage } : {}),
  };
}

/** Extract catalog column defs for a transform asset from last run dbt manifest. */
export function dbtColumnsForModel(
  manifest: DbtRunManifest | undefined,
  modelName: string
): { description?: string; columns: { name: string; type?: string; description?: string; source: "dbt" }[] } {
  const model = manifest?.models?.find((m) => m.name.toLowerCase() === modelName.toLowerCase());
  if (!model) return { columns: [] };
  return {
    description: model.description,
    columns: (model.columns ?? []).map((c) => ({ ...c, source: "dbt" as const })),
  };
}
