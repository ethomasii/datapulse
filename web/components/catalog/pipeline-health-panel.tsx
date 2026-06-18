"use client";

import Link from "next/link";
import type { PipelineHealthSummary } from "@/lib/elt/pipeline-health";
import { formatHealthRows } from "@/lib/elt/pipeline-health";

const STATUS_STYLES: Record<PipelineHealthSummary["status"], string> = {
  healthy: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300",
  degraded: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  failing: "bg-red-100 text-red-800 dark:bg-red-950/50 dark:text-red-300",
  unknown: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400",
};

export function PipelineHealthPanel({ health }: { health: PipelineHealthSummary[] }) {
  if (!health.length) return null;

  const failing = health.filter((h) => h.status === "failing").length;
  const degraded = health.filter((h) => h.status === "degraded").length;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline health (7d)</h2>
        <p className="text-xs text-slate-500">
          {failing > 0 ? `${failing} failing` : null}
          {failing > 0 && degraded > 0 ? " · " : null}
          {degraded > 0 ? `${degraded} degraded` : null}
          {failing === 0 && degraded === 0 ? "All monitored pipelines OK" : null}
        </p>
      </div>
      <ul className="mt-3 divide-y divide-slate-100 dark:divide-slate-800">
        {health.slice(0, 8).map((h) => (
          <li key={h.pipelineId} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
            <div className="min-w-0">
              <Link
                href={`/assets?pipeline=${encodeURIComponent(h.pipelineId)}`}
                className="font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                {h.pipelineName}
              </Link>
              {h.issues[0] ? (
                <p className="mt-0.5 truncate text-xs text-slate-500">{h.issues[0]}</p>
              ) : null}
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className={`rounded-full px-2 py-0.5 font-semibold ${STATUS_STYLES[h.status]}`}>{h.label}</span>
              {h.successRate7d !== null ? <span className="text-slate-500">{h.successRate7d}% success</span> : null}
              {h.lastRowsLoaded !== null ? (
                <span className="text-slate-500">{formatHealthRows(h.lastRowsLoaded)} rows</span>
              ) : null}
              <Link href={`/runs?pipeline=${encodeURIComponent(h.pipelineId)}`} className="text-sky-600 hover:underline dark:text-sky-400">
                Runs
              </Link>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
