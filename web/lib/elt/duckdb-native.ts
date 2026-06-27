/**
 * Lazy DuckDB native module loader for server routes.
 * Do not use webpackIgnore — Vercel file tracing must see this import.
 */

type DuckdbDatabase = import("duckdb").Database;

export type DuckdbConnection = ReturnType<DuckdbDatabase["connect"]>;

export async function openDuckdbReadOnly(dbPath: string): Promise<{
  db: DuckdbDatabase;
  conn: DuckdbConnection;
}> {
  const mod = await import("duckdb");
  const { Database } = mod.default ?? mod;
  const db = new Database(dbPath, { access_mode: "READ_ONLY" });
  const conn = db.connect();
  return { db, conn };
}

export function isDuckdbModuleMissingError(message: string): boolean {
  const m = message.toLowerCase();
  return (
    m.includes("cannot find package 'duckdb'") ||
    m.includes('cannot find package "duckdb"') ||
    m.includes("cannot find module 'duckdb'") ||
    m.includes('cannot find module "duckdb"')
  );
}
