/**
 * Lazy DuckDB native module loader for server routes.
 * Do not use webpackIgnore — Vercel file tracing must see this import.
 */

import { mkdirSync } from "fs";
import { tmpdir } from "os";

type DuckdbDatabase = import("duckdb").Database;
type DuckdbError = import("duckdb").DuckDbError;
type DuckdbDatabaseCtor = typeof import("duckdb").Database;

export type DuckdbConnection = ReturnType<DuckdbDatabase["connect"]>;

function isMotherduckOrRemoteDbPath(dbPath: string): boolean {
  const path = dbPath.trim();
  if (path.toLowerCase().startsWith("md:")) return true;
  return /^[a-z][a-z0-9+.-]*:\/\//i.test(path);
}

/** Writable DuckDB home on serverless (Vercel/Lambda have no $HOME). */
export function resolveDuckdbHomeDirectory(): string {
  return process.env.HOME?.trim() || process.env.DUCKDB_HOME?.trim() || tmpdir() || "/tmp";
}

export function duckdbExtensionDirectory(home: string): string {
  return `${home.replace(/\/+$/, "")}/.duckdb/extensions`;
}

/** Ensure HOME and extension dirs exist before opening MotherDuck / httpfs. */
export function ensureDuckdbServerlessEnvironment(): string {
  const home = resolveDuckdbHomeDirectory();
  if (!process.env.HOME?.trim()) {
    process.env.HOME = home;
  }
  try {
    mkdirSync(duckdbExtensionDirectory(home), { recursive: true });
  } catch {
    /* best effort — /tmp usually writable on Vercel */
  }
  return home;
}

function duckdbOpenConfig(home: string, readOnly: boolean): Record<string, string> {
  const config: Record<string, string> = {
    home_directory: home,
    extension_directory: duckdbExtensionDirectory(home),
  };
  if (readOnly) config.access_mode = "READ_ONLY";
  return config;
}

async function loadDuckdbDatabaseClass(): Promise<DuckdbDatabaseCtor> {
  const mod = await import("duckdb");
  const { Database } = mod.default ?? mod;
  return Database;
}

function openDatabaseAsync(
  Database: DuckdbDatabaseCtor,
  dbPath: string,
  home: string
): Promise<DuckdbDatabase> {
  return new Promise((resolve, reject) => {
    const onReady = (err: DuckdbError | null) => {
      if (err) reject(err);
      else resolve(db);
    };
    const readOnly = !isMotherduckOrRemoteDbPath(dbPath);
    const db = new Database(dbPath, duckdbOpenConfig(home, readOnly), onReady);
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

function runConnectionSql(conn: DuckdbConnection, sql: string): Promise<void> {
  return new Promise((resolve, reject) => {
    conn.run(sql, (err: DuckdbError | null) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function configureDuckdbConnection(conn: DuckdbConnection, home: string): Promise<void> {
  const escapedHome = home.replace(/'/g, "''");
  const escapedExt = duckdbExtensionDirectory(home).replace(/'/g, "''");
  await runConnectionSql(conn, `SET home_directory='${escapedHome}';`);
  await runConnectionSql(conn, `SET extension_directory='${escapedExt}';`);
}

export async function openDuckdbReadOnly(dbPath: string): Promise<{
  db: DuckdbDatabase;
  conn: DuckdbConnection;
}> {
  const home = ensureDuckdbServerlessEnvironment();
  const Database = await loadDuckdbDatabaseClass();
  const db = await openDatabaseAsync(Database, dbPath, home);
  if (isMotherduckOrRemoteDbPath(dbPath)) {
    await waitForDatabase(db);
  }
  const conn = db.connect();
  await configureDuckdbConnection(conn, home);
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
    m.includes("different configuration than existing connections") ||
    m.includes("can't find the home directory") ||
    m.includes("home directory")
  );
}

export function isMotherduckOrRemotePath(dbPath: string): boolean {
  return isMotherduckOrRemoteDbPath(dbPath);
}
