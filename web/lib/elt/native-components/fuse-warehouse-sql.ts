/**
 * Fuse consecutive warehouse CTAS steps into a single CREATE TABLE … AS (Phase A).
 * Breaks naturally at Python/LLM steps, chain mismatches, and explicit materialize breakpoints.
 */

import { sqlCreateTableAs, sqlQualifiedTable } from "@/lib/elt/native-components/definitions/_sql-helpers";

export type ParsedCtas = {
  outputTable: string;
  selectSql: string;
  raw: string;
};

/** Normalize schema.table for comparison. */
export function normalizeTableRef(ref: string): string {
  return ref
    .trim()
    .replace(/"/g, "")
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean)
    .join(".")
    .toLowerCase();
}

export function parseCtasStatement(sql: string): ParsedCtas | null {
  const trimmed = sql.trim();
  const match = trimmed.match(/^CREATE\s+OR\s+REPLACE\s+TABLE\s+([\s\S]+?)\s+AS\s+([\s\S]+)$/i);
  if (!match) return null;
  const outputTable = normalizeTableRef(match[1]!);
  const selectSql = match[2]!.trim();
  if (!outputTable || !selectSql) return null;
  return { outputTable, selectSql, raw: trimmed };
}

/** Primary input table (first FROM target) for single-statement CTAS chains. */
export function extractPrimaryInputTable(selectSql: string): string | null {
  const m = selectSql.match(
    /\bFROM\s+((?:"[^"]+"(?:\s*\.\s*"[^"]+")*|[a-zA-Z_][\w]*(?:\.[a-zA-Z_][\w]*)*))(?:\s+(?:AS\s+)?([a-zA-Z_][\w]*))?/i
  );
  if (!m) return null;
  return normalizeTableRef(m[1]!);
}

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Replace the first FROM table reference with an inline subquery. */
export function replacePrimaryFromTable(
  selectSql: string,
  inputTable: string,
  subquerySql: string,
  alias: string
): string {
  const qualified = sqlQualifiedTable(inputTable);
  const normalized = normalizeTableRef(inputTable);
  const candidates = [qualified, inputTable.trim()];
  if (normalized.includes(".")) {
    const [schema, ...rest] = normalized.split(".");
    candidates.push(`${schema}.${rest.join(".")}`);
  }

  for (const form of [...new Set(candidates)]) {
    const pattern = new RegExp(
      `(\\bFROM\\s+)${escapeRegExp(form)}(\\s+(?:AS\\s+)?[a-zA-Z_][\\w]*)?`,
      "i"
    );
    if (pattern.test(selectSql)) {
      return selectSql.replace(
        pattern,
        `$1(\n${subquerySql}\n) AS ${alias}$2`
      );
    }
  }

  return selectSql;
}

export function canChainCtas(prev: ParsedCtas, next: ParsedCtas): boolean {
  const input = extractPrimaryInputTable(next.selectSql);
  return Boolean(input && input === prev.outputTable);
}

/** Merge a linear CTAS chain into one statement targeting the last output table. */
export function fuseCtasChain(statements: string[]): string | null {
  if (statements.length <= 1) return statements[0] ?? null;

  const parsed = statements.map(parseCtasStatement);
  if (parsed.some((p) => !p)) return null;

  const chain = parsed as ParsedCtas[];
  for (let i = 0; i < chain.length - 1; i++) {
    if (!canChainCtas(chain[i]!, chain[i + 1]!)) return null;
  }

  let body = chain[0]!.selectSql;
  for (let i = 1; i < chain.length; i++) {
    const prev = chain[i - 1]!;
    body = replacePrimaryFromTable(chain[i]!.selectSql, prev.outputTable, body, `_elt_f${i}`);
  }

  const finalTable = chain[chain.length - 1]!.outputTable;
  return sqlCreateTableAs(finalTable, body);
}

export function isFusibleCtasStatement(sql: string): boolean {
  return parseCtasStatement(sql) != null;
}

export function shouldMaterializeStep(config: Record<string, unknown>): boolean {
  const mat = String(config.materialization ?? config.elt_materialization ?? "ephemeral")
    .trim()
    .toLowerCase();
  return mat === "table" || mat === "view";
}

export function isSqlFusionEnabled(config: Record<string, unknown>): boolean {
  if (config.elt_sql_fusion === false) return false;
  return true;
}

export type SqlFusionFlushResult = {
  statements: string[];
  fusedCount: number;
};

/** Flush buffered CTAS statements — fuse when possible. */
export function flushFusedSqlSegment(segment: string[]): SqlFusionFlushResult {
  if (!segment.length) return { statements: [], fusedCount: 0 };
  if (segment.length === 1) {
    return { statements: [segment[0]!], fusedCount: 0 };
  }
  const fused = fuseCtasChain(segment);
  if (fused) {
    return { statements: [fused], fusedCount: segment.length };
  }
  return { statements: [...segment], fusedCount: 0 };
}
