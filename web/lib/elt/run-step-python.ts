/**
 * Execute compiled component Python inline against the pipeline destination (per-node run).
 */
import { spawn } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { buildPostgresConnectionString } from "@/lib/elt/warehouse-introspect-connectors";
import { resolveDuckdbDatabaseLocation } from "@/lib/elt/duckdb-destination";
import type { DestinationConnectionRow } from "@/lib/elt/warehouse-introspect";

const STEP_TIMEOUT_MS = 90_000;

function asConfig(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function secret(secrets: Record<string, string>, ...keys: string[]): string {
  for (const k of keys) {
    const v = secrets[k]?.trim();
    if (v) return v;
  }
  return "";
}

/** Build SQLAlchemy URL for inline step execution. */
export function buildStepEngineUrl(connection: DestinationConnectionRow): string | null {
  const connector = connection.connector.toLowerCase().trim();
  const secrets = parseStoredConnectionSecrets(connection.connectionSecretsEnc);
  const config = asConfig(connection.config);

  if (connector === "postgres" || connector === "postgresql" || connector === "redshift") {
    return buildPostgresConnectionString(secrets, config);
  }

  if (connector === "duckdb" || connector === "sqlite") {
    const dbPath =
      connector === "sqlite"
        ? secret(secrets, "DEST_SQLITE_PATH") || String(config.path ?? "").trim()
        : resolveDuckdbDatabaseLocation(secrets, config) || "./data.duckdb";
    if (!dbPath) return null;
    const isUri = /^[a-z][a-z0-9+.-]*:\/\//i.test(dbPath);
    const target = isUri || dbPath.startsWith("./") ? dbPath : path.isAbsolute(dbPath) ? dbPath : path.resolve(dbPath);
    return `duckdb:///${target.replace(/^\/+/, "")}`;
  }

  if (connector === "motherduck") {
    const token = secret(secrets, "MOTHERDUCK_TOKEN", "DEST_MOTHERDUCK_TOKEN");
    const database = String(config.database ?? config.database_name ?? "md").trim();
    if (!token) return null;
    return `duckdb:md:${database}?motherduck_token=${encodeURIComponent(token)}`;
  }

  return null;
}

/** Wrap pipeline-style python blocks for standalone execution. */
export function wrapStepPythonBlocks(pythonLines: string[]): string {
  const body = pythonLines.join("\n");
  return `import pandas as pd
from sqlalchemy import create_engine
import os

_engine = create_engine(os.environ["ELTPULSE_STEP_ENGINE_URL"])

class _SqlClient:
    def __init__(self, engine):
        self._engine = engine

class _DestClient:
    def __init__(self, engine):
        self._engine = engine
    def sql_client(self):
        return _SqlClient(self._engine)

class _PipelineShim:
    state = {}
    def _get_destination_clients(self, state):
        return [_DestClient(_engine)]

pipeline = _PipelineShim()

${body}
`;
}

export type StepPythonResult = {
  ok: boolean;
  stdout: string;
  stderr: string;
  exitCode: number | null;
  message: string;
};

export async function runStepPython(
  connection: DestinationConnectionRow,
  pythonLines: string[]
): Promise<StepPythonResult> {
  if (!pythonLines.length) {
    return { ok: true, stdout: "", stderr: "", exitCode: 0, message: "No Python to execute." };
  }

  const engineUrl = buildStepEngineUrl(connection);
  if (!engineUrl) {
    return {
      ok: false,
      stdout: "",
      stderr: "",
      exitCode: null,
      message: `Inline Python not supported for connector ${connection.connector} yet — save and run full pipeline.`,
    };
  }

  const script = wrapStepPythonBlocks(pythonLines);
  const tmpDir = await fs.mkdtemp(path.join(os.tmpdir(), "eltpulse-step-"));
  const scriptPath = path.join(tmpDir, "step_run.py");
  await fs.writeFile(scriptPath, script, "utf8");

  const pythonBin = process.env.ELTPULSE_STEP_PYTHON ?? (process.platform === "win32" ? "python" : "python3");

  return new Promise((resolve) => {
    const child = spawn(pythonBin, [scriptPath], {
      env: {
        ...process.env,
        ELTPULSE_STEP_ENGINE_URL: engineUrl,
      },
      timeout: STEP_TIMEOUT_MS,
    });

    let stdout = "";
    let stderr = "";
    child.stdout.on("data", (d: Buffer) => {
      stdout += d.toString();
    });
    child.stderr.on("data", (d: Buffer) => {
      stderr += d.toString();
    });
    child.on("error", (err) => {
      void fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      resolve({
        ok: false,
        stdout,
        stderr: `${stderr}\n${err.message}`.trim(),
        exitCode: null,
        message: `Python not available (${pythonBin}). Install python3 with pandas, sqlalchemy, duckdb-engine on the web host.`,
      });
    });
    child.on("close", (code) => {
      void fs.rm(tmpDir, { recursive: true, force: true }).catch(() => {});
      const ok = code === 0;
      resolve({
        ok,
        stdout: stdout.trim(),
        stderr: stderr.trim(),
        exitCode: code,
        message: ok
          ? "Python step executed successfully."
          : `Python step failed (exit ${code ?? "?"}).`,
      });
    });
  });
}
