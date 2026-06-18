/** Warehouse push-down SQL helpers for native transform compilers. */

export function sqlQualifiedTable(table: string): string {
  const parts = table
    .split(".")
    .map((p) => p.trim())
    .filter(Boolean);
  if (!parts.length) return table;
  return parts.map((p) => `"${p.replace(/"/g, '""')}"`).join(".");
}

export function sqlCreateTableAs(output: string, selectSql: string): string {
  return `CREATE OR REPLACE TABLE ${sqlQualifiedTable(output)} AS\n${selectSql}`;
}

/** Worker dataframe path when execution is dataframe|pandas|worker. */
export function useDataframeExecution(config: Record<string, unknown>): boolean {
  const mode = String(config.execution ?? config.transform_mode ?? "warehouse").toLowerCase();
  return mode === "dataframe" || mode === "pandas" || mode === "worker";
}

/** Best-effort pandas query → SQL WHERE (for legacy configs). */
export function pandasQueryToSqlWhere(expr: string): string {
  const s = expr.trim();
  if (!s) return s;
  if (/\s=\s/.test(s) && !/==/.test(s)) return s;
  return s
    .replace(/\s+and\s+/gi, " AND ")
    .replace(/\s+or\s+/gi, " OR ")
    .replace(/==/g, " = ")
    .replace(/!=/g, " <> ")
    .replace(/\s+in\s+\(/gi, " IN (")
    .trim();
}

export function sqlJoinKeyword(how: string): string {
  switch (how.toLowerCase()) {
    case "left":
      return "LEFT JOIN";
    case "right":
      return "RIGHT JOIN";
    case "outer":
    case "full":
      return "FULL OUTER JOIN";
    default:
      return "INNER JOIN";
  }
}

export function sqlAggExpr(column: string, fn: string): string {
  const col = `"${column.replace(/"/g, '""')}"`;
  switch (fn.toLowerCase()) {
    case "sum":
      return `SUM(${col})`;
    case "count":
      return `COUNT(${col})`;
    case "avg":
    case "mean":
      return `AVG(${col})`;
    case "min":
      return `MIN(${col})`;
    case "max":
      return `MAX(${col})`;
    case "count_distinct":
    case "nunique":
      return `COUNT(DISTINCT ${col})`;
    default:
      return `${fn.toUpperCase()}(${col})`;
  }
}
