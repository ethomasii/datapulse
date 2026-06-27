/**
 * Lazy DuckDB native module loader for server routes.
 * Do not use webpackIgnore — Vercel file tracing must see this import.
 */

type DuckdbDatabase = import("duckdb").Database;
type DuckdbError = import("duckdb").DuckDbError;
type DuckdbDatabaseCtor = typeof import("duckdb").Database;

export type DuckdbConnection = ReturnType<DuckdbDatabase["connect"]>;

function isMotherduckOrRemoteDbPath(dbPath: string): boolean {
  const path = dbPath.trim();
  if (path.toLowerCase().startsWith("md:")) return true;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path);
}

async function loadDuckdbDatabaseClass(): Promise<DuckdbDatabaseCtor> {
  const mod = await import("duckdb");
  const { Database } = mod.default ?? mod;
  return Database;
}

function openDatabaseAsync(
  Database: DuckdbDatabaseCtor,
  dbPath: string
): Promise<DuckdbDatabase> {
  return new Promise((resolve, reject) => {
    const onReady = (err: DuckdbError | null) => {
      if (err) reject(err);
      else resolve(db);
    };
    const db = isMotherduckOrRemoteDbPath(dbPath)
      ? new Database(dbPath, onReady)
      : new Database(dbPath, { access_mode: "READ_ONLY" }, onReady);
  });
}

function waitForDatabase(db: DuckdbDatabase): Promise<void> {
  return new Promise((resolve, reject) => {
    db.wait((err: DuckdbError | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export async function openDuckdbReadOnly(dbPath: string): Promise<{
  db: DuckdbDatabase;
  conn: DuckdbConnection;
}> {
  const Database = await loadDuckdbDatabaseClass();
  const db = await openDatabaseAsync(Database, dbPath);
  if (isMotherduckOrRemoteDbPath(dbPath)) {
    await waitForDatabase(db);
  }
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

/** Native duckdb failed at runtime — fall back to MotherDuck MCP HTTP. */
export function isDuckdbNativeFallbackError(message: string): boolean {
  if (isDuckdbModuleMissingError(message)) return true;
  const m = message.toLowerCase();
  return (
    m.includes("connection was never established") ||
    m.includes("has been closed already") ||
    m.includes("different configuration than existing connections")
  );
}

export function isMotherduckOrRemotePath(dbPath: string): boolean {
  return isMotherduckOrRemoteDbPath(dbPath);
}
