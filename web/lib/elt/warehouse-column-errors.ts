/** Client-safe MotherDuck column error copy (no warehouse driver imports). */

import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

export function isMotherduckMissingObjectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("does not exist") ||
    m.includes("catalog error") ||
    (m.includes("table") && m.includes("not found"))
  );
}

/** HTTP/API attach to a named MotherDuck catalog failed (wrong Database field). */
export function isMotherduckDatabaseAttachError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    (m.includes("database") && m.includes("not found")) ||
    m.includes("not_found") ||
    (m.includes("http 404") && m.includes("motherduck"))
  );
}

export function isMotherduckCredentialError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("motherduck_token") ||
    m.includes("set motherduck_token") ||
    m.includes("unauthorized") ||
    m.includes("401") ||
    m.includes("could not decrypt") ||
    m.includes("encryption_key")
  );
}

export function formatMotherduckColumnError(
  schema: string,
  table: string,
  configuredDatabase: string,
  lastError?: string
): string {
  if (lastError && isMotherduckCredentialError(lastError)) {
    return lastError.slice(0, 240);
  }
  if (lastError && /http 404/i.test(lastError)) {
    return lastError.slice(0, 240);
  }
  if (lastError && !isMotherduckMissingObjectError(lastError)) {
    return lastError.slice(0, 200);
  }
  const configured = configuredDatabase.trim() || STARTER_WAREHOUSE_DEFAULT_DB;
  const dltDefault = STARTER_WAREHOUSE_DEFAULT_DB;
  const catalogHint =
    configured.toLowerCase() === dltDefault.toLowerCase()
      ? "Run a pipeline sync if the table is new, then retry."
      : `Set Database on your destination connection to "${dltDefault}" (currently "${configured}") where dlt wrote data, then retry.`;
  return `No columns found for ${schema}.${table} in MotherDuck database "${configured}". ${catalogHint}`;
}

/** Parse schema.table and format a MotherDuck column-load error. */
export function formatMotherduckColumnErrorForTableRef(
  tableRef: string,
  configuredDatabase: string,
  lastError?: string
): string {
  const parts = tableRef.trim().split(".");
  const table = parts.length ? parts[parts.length - 1]! : "table";
  const schema = parts.length > 1 ? parts.slice(0, -1).join(".") : "main";
  return formatMotherduckColumnError(schema, table, configuredDatabase, lastError);
}
