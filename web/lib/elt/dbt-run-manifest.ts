/**
 * dbt run results stored on `EltPipelineRun.telemetry.dbt` (v2).
 * Workers PATCH via `dbtManifest` on run PATCH; UI falls back to config-derived expectations.
 */

import { readDbtTransformConfig } from "@/lib/elt/dbt-run-phases";
import { dbtHubPackageDisplayName, resolveDbtHubPackage } from "@/lib/elt/dbt-hub-packages";

export type DbtModelRunResult = {
  name: string;
  status: "success" | "skipped" | "error";
  executionTimeMs?: number;
};

export type DbtTestRunResult = {
  name: string;
  status: "pass" | "fail" | "warn" | "error" | "skipped";
  message?: string;
};

export type DbtRunManifest = {
  packagePath?: string;
  datasetName?: string;
  models: DbtModelRunResult[];
  tests: DbtTestRunResult[];
  /** ISO timestamp when manifest was recorded */
  recordedAt?: string;
  /** config = inferred from pipeline; runner = reported by executor */
  source?: "config" | "runner";
};

function str(v: unknown, max: number): string | undefined {
  if (typeof v !== "string") return undefined;
  const t = v.trim();
  if (!t) return undefined;
  return t.length > max ? t.slice(0, max) : t;
}

function modelStatus(v: unknown): DbtModelRunResult["status"] {
  const s = String(v ?? "").toLowerCase();
  if (s === "error" || s === "fail" || s === "failed") return "error";
  if (s === "skipped" || s === "skip") return "skipped";
  return "success";
}

function testStatus(v: unknown): DbtTestRunResult["status"] {
  const s = String(v ?? "").toLowerCase();
  if (s === "fail" || s === "failed") return "fail";
  if (s === "warn" || s === "warning") return "warn";
  if (s === "error") return "error";
  if (s === "skipped" || s === "skip") return "skipped";
  return "pass";
}

export function sanitizeDbtRunManifest(raw: unknown): DbtRunManifest | null {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return null;
  const o = raw as Record<string, unknown>;
  const models: DbtModelRunResult[] = [];
  const tests: DbtTestRunResult[] = [];

  if (Array.isArray(o.models)) {
    for (const item of o.models) {
      if (!item || typeof item !== "object") continue;
      const m = item as Record<string, unknown>;
      const name = str(m.name, 256);
      if (!name) continue;
      const ms = typeof m.executionTimeMs === "number" && Number.isFinite(m.executionTimeMs) ? m.executionTimeMs : undefined;
      models.push({ name, status: modelStatus(m.status), ...(ms !== undefined ? { executionTimeMs: ms } : {}) });
    }
  }

  if (Array.isArray(o.tests)) {
    for (const item of o.tests) {
      if (!item || typeof item !== "object") continue;
      const t = item as Record<string, unknown>;
      const name = str(t.name, 256);
      if (!name) continue;
      const message = str(t.message, 2000);
      tests.push({
        name,
        status: testStatus(t.status),
        ...(message ? { message } : {}),
      });
    }
  }

  if (models.length === 0 && tests.length === 0 && !str(o.packagePath, 512)) return null;

  const sourceRaw = str(o.source, 16);
  const source = sourceRaw === "runner" ? "runner" : sourceRaw === "config" ? "config" : undefined;

  return {
    ...(str(o.packagePath, 512) ? { packagePath: str(o.packagePath, 512) } : {}),
    ...(str(o.datasetName, 256) ? { datasetName: str(o.datasetName, 256) } : {}),
    models,
    tests,
    ...(str(o.recordedAt, 64) ? { recordedAt: str(o.recordedAt, 64) } : {}),
    ...(source ? { source } : {}),
  };
}

/** Expected dbt models/tests from pipeline config (shown when runner did not PATCH a manifest). */
export function inferDbtManifestFromPipelineConfig(
  sourceType: string,
  sourceConfiguration: unknown,
  runStatus: string
): DbtRunManifest | null {
  const dbt = readDbtTransformConfig(sourceConfiguration);
  if (!dbt || !Boolean(dbt.enabled)) return null;
  const packagePath = String(dbt.package_path ?? "").trim();
  if (!packagePath) return null;

  const hub = resolveDbtHubPackage(sourceType);

  const models = (hub?.models ?? []).map((name) => ({
    name,
    status: runStatus === "succeeded" ? ("success" as const) : runStatus === "failed" ? ("error" as const) : ("skipped" as const),
  }));

  const datasetName =
    typeof dbt.dataset_name === "string" && dbt.dataset_name.trim()
      ? dbt.dataset_name.trim()
      : undefined;

  return {
    packagePath,
    ...(datasetName ? { datasetName } : {}),
    models,
    tests: [],
    source: "config",
    recordedAt: new Date().toISOString(),
  };
}

/** Build a demo manifest for managed stub runs with dbt enabled. */
export function buildStubDbtRunManifest(sourceType: string, sourceConfiguration: unknown): DbtRunManifest {
  const dbt = readDbtTransformConfig(sourceConfiguration);
  const packagePath = String(dbt?.package_path ?? "./dbt").trim() || "./dbt";
  const hub = resolveDbtHubPackage(sourceType);
  const modelNames = hub?.models?.length ? hub.models : ["stg_example"];

  return {
    packagePath,
    datasetName:
      typeof dbt?.dataset_name === "string" && dbt.dataset_name.trim() ? dbt.dataset_name.trim() : undefined,
    models: modelNames.map((name) => ({ name, status: "success" as const, executionTimeMs: 1200 })),
    tests: [
      { name: "not_null_stg_example_id", status: "pass" as const },
      { name: "unique_stg_example_id", status: "pass" as const },
    ],
    source: "runner",
    recordedAt: new Date().toISOString(),
  };
}

export function dbtFailedTests(manifest: DbtRunManifest | null | undefined): DbtTestRunResult[] {
  if (!manifest?.tests?.length) return [];
  return manifest.tests.filter((t) => t.status === "fail" || t.status === "error");
}

export function dbtManifestPackageLabel(manifest: DbtRunManifest): string {
  if (manifest.packagePath) return dbtHubPackageDisplayName(manifest.packagePath);
  return "dbt project";
}
