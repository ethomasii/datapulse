/**
 * Scratch schema for intermediate MotherDuck/DuckDB tables (auto-cleaned each run).
 */

import { normalizeTableRef, parseCtasStatement } from "./fuse-warehouse-sql";
import { sqlQualifiedTable } from "./definitions/_sql-helpers";

export const ELT_SCRATCH_SCHEMA = "_eltpulse_scratch";

export function pipelineSlug(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 48) || "pipeline";
}

/** Map a logical table to scratch schema (keeps table name segment). */
export function toScratchTable(logicalTable: string, pipelineName: string): string {
  const norm = normalizeTableRef(logicalTable);
  const parts = norm.split(".");
  const tableName = parts.length > 1 ? parts.slice(1).join("_") : parts[0]!;
  const slug = pipelineSlug(pipelineName);
  return `${ELT_SCRATCH_SCHEMA}.${slug}__${tableName}`.slice(0, 120);
}

export function rewriteCtasToScratchTable(sql: string, scratchTable: string): string {
  const parsed = parseCtasStatement(sql);
  if (!parsed) return sql;
  const select = parsed.selectSql;
  return `CREATE OR REPLACE TABLE ${sqlQualifiedTable(scratchTable)} AS\n${select}`;
}

export function ensureScratchSchemaSql(): string {
  return `CREATE SCHEMA IF NOT EXISTS ${sqlQualifiedTable(ELT_SCRATCH_SCHEMA)}`;
}

export function dropScratchTableSql(scratchTable: string): string {
  return `DROP TABLE IF EXISTS ${sqlQualifiedTable(scratchTable)}`;
}

export function componentOutputTable(config: Record<string, unknown>): string | null {
  const t = String(
    config.output_table ?? config.asset_name ?? config.asset_key ?? ""
  ).trim();
  return t || null;
}

export function componentInputTables(config: Record<string, unknown>): string[] {
  const refs: string[] = [];
  for (const key of [
    "table",
    "input_table",
    "left_table",
    "right_table",
    "left_asset_key",
    "right_asset_key",
  ]) {
    const v = String(config[key] ?? "").trim();
    if (v) refs.push(normalizeTableRef(v));
  }
  return refs;
}

/** Outputs consumed downstream (not final publish) → scratch unless materialization: table. */
export function scratchOutputTables(
  components: Array<{ id: string; config?: Record<string, unknown> }>,
  opts?: { pipelineName?: string }
): Map<string, string> {
  const pipelineName = opts?.pipelineName ?? "pipeline";
  const inputs = new Set<string>();
  for (const c of components) {
    for (const t of componentInputTables((c.config ?? {}) as Record<string, unknown>)) {
      inputs.add(t);
    }
  }

  const last = components[components.length - 1];
  const lastOut = last
    ? componentOutputTable((last.config ?? {}) as Record<string, unknown>)
    : null;
  const lastNorm = lastOut ? normalizeTableRef(lastOut) : null;

  const out = new Map<string, string>();
  for (const c of components) {
    const cfg = (c.config ?? {}) as Record<string, unknown>;
    const logical = componentOutputTable(cfg);
    if (!logical) continue;
    const norm = normalizeTableRef(logical);
    const mat = String(cfg.materialization ?? cfg.elt_materialization ?? "ephemeral")
      .toLowerCase();
    if (mat === "table") continue;
    if (lastNorm && norm === lastNorm) continue;
    if (inputs.has(norm)) {
      out.set(norm, toScratchTable(logical, pipelineName));
    }
  }
  return out;
}
