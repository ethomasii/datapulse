/** Client-safe MotherDuck column error copy (no warehouse driver imports). */

import { STARTER_WAREHOUSE_DEFAULT_DB } from "@/lib/elt/starter-warehouse";

export function isMotherduckMissingObjectError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m === "not found" ||
    m.includes("does not exist") ||
    m.includes("not_found") ||
    m.includes("catalog error")
  );
}

export function formatMotherduckColumnError(
  schema: string,
  table: string,
  configuredDatabase: string,
  lastError?: string
): string {
  if (lastError && !isMotherduckMissingObjectError(lastError)) {
    return lastError.slice(0, 200);
  }
  return (
    `No columns found for ${schema}.${table} in MotherDuck database "${configuredDatabase}". ` +
    `Set Database on your destination connection to where dlt wrote data (often "my_db", not "${STARTER_WAREHOUSE_DEFAULT_DB}"), then retry.`
  );
}
