"use client";

import type { DbtRunManifest } from "@/lib/elt/dbt-run-manifest";
import {
  dbtFailedTests,
  dbtManifestPackageLabel,
  inferDbtManifestFromPipelineConfig,
} from "@/lib/elt/dbt-run-manifest";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { CheckCircle2, GitBranch, XCircle } from "lucide-react";

type Props = {
  telemetryRaw: unknown;
  runStatus: string;
  sourceType?: string;
  sourceConfiguration?: unknown;
};

function resolveManifest(
  telemetryRaw: unknown,
  sourceType: string | undefined,
  sourceConfiguration: unknown,
  runStatus: string
): { manifest: DbtRunManifest; inferred: boolean } | null {
  const tel = parseRunTelemetry(telemetryRaw);
  if (tel.dbt) return { manifest: tel.dbt, inferred: false };
  if (!sourceType) return null;
  const inferred = inferDbtManifestFromPipelineConfig(sourceType, sourceConfiguration, runStatus);
  if (!inferred) return null;
  return { manifest: inferred, inferred: true };
}

export function RunDbtManifestPanel({
  telemetryRaw,
  runStatus,
  sourceType,
  sourceConfiguration,
}: Props) {
  const resolved = resolveManifest(telemetryRaw, sourceType, sourceConfiguration, runStatus);
  if (!resolved) return null;

  const { manifest, inferred } = resolved;
  const failures = dbtFailedTests(manifest);

  return (
    <div className="rounded-xl border border-violet-200/80 bg-violet-50/50 p-4 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-center gap-2">
        <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">dbt transform</h3>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-900/40 dark:text-violet-200">
          {dbtManifestPackageLabel(manifest)}
        </span>
        {inferred ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            Expected from config
          </span>
        ) : (
          <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Reported by runner
          </span>
        )}
      </div>

      {manifest.datasetName ? (
        <p className="mt-2 text-xs text-slate-600 dark:text-slate-400">
          Target dataset: <code className="font-mono">{manifest.datasetName}</code>
        </p>
      ) : null}

      {manifest.models.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Models</p>
          <ul className="mt-1 space-y-1">
            {manifest.models.map((m) => (
              <li key={m.name} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
                {m.status === "success" ? (
                  <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
                ) : m.status === "error" ? (
                  <XCircle className="h-3.5 w-3.5 shrink-0 text-red-600" aria-hidden />
                ) : (
                  <span className="h-3.5 w-3.5 shrink-0 rounded-full bg-slate-300 dark:bg-slate-600" aria-hidden />
                )}
                <span className="font-mono">{m.name}</span>
                {typeof m.executionTimeMs === "number" ? (
                  <span className="text-slate-400">{(m.executionTimeMs / 1000).toFixed(1)}s</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {manifest.tests.length > 0 ? (
        <div className="mt-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Tests</p>
          <ul className="mt-1 space-y-1">
            {manifest.tests.map((t) => (
              <li key={t.name} className="text-xs text-slate-700 dark:text-slate-300">
                <span className="inline-flex items-center gap-1.5">
                  {t.status === "pass" ? (
                    <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" aria-hidden />
                  ) : (
                    <XCircle className="h-3.5 w-3.5 text-red-600" aria-hidden />
                  )}
                  <span className="font-mono">{t.name}</span>
                  <span className="text-slate-400">({t.status})</span>
                </span>
                {t.message ? <p className="ml-5 mt-0.5 text-slate-500">{t.message}</p> : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {failures.length > 0 ? (
        <p className="mt-3 text-xs font-medium text-red-700 dark:text-red-300">
          {failures.length} dbt test failure{failures.length === 1 ? "" : "s"} — included in run webhooks when configured.
        </p>
      ) : null}
    </div>
  );
}
