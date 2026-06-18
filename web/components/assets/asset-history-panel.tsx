"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { BarChart3, Clock, GitBranch, Loader2, MessageSquare, PlayCircle } from "lucide-react";
import { BarChart } from "@/components/ui/bar-chart";
import type { AssetActivityEvent, AssetRunHistoryRow } from "@/lib/elt/asset-run-history";
import { formatDurationMs, formatRows } from "@/lib/elt/run-telemetry";

type HistoryResponse = {
  windowDays: number;
  runHistory: AssetRunHistoryRow[];
  metrics: {
    buckets: Array<{ date: string; runs: number; succeeded: number; rowsLoaded: number; bytesLoaded: number }>;
    totals: { runs: number; succeeded: number; rowsLoaded: number; bytesLoaded: number };
  };
  activity: AssetActivityEvent[];
  github: { connected: boolean; commits: Array<{ sha: string; message: string; htmlUrl: string }> };
};

const EVENT_ICONS = {
  run: PlayCircle,
  slice: Clock,
  catalog: BarChart3,
  comment: MessageSquare,
  github: GitBranch,
} as const;

function StatusDot({ status }: { status?: string }) {
  const cls =
    status === "succeeded"
      ? "bg-emerald-500"
      : status === "failed" || status === "cancelled"
        ? "bg-red-500"
        : status === "running" || status === "pending"
          ? "bg-sky-500"
          : "bg-slate-400";
  return <span className={`inline-block h-2 w-2 shrink-0 rounded-full ${cls}`} aria-hidden />;
}

export function AssetHistoryPanel({ assetKey }: { assetKey: string }) {
  const [data, setData] = useState<HistoryResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<"runs" | "activity">("runs");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/elt/assets/history?assetKey=${encodeURIComponent(assetKey)}&days=60`);
      if (res.ok) setData((await res.json()) as HistoryResponse);
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading history…
      </p>
    );
  }

  if (!data) return null;

  const chartDays = data.metrics.buckets.map((b) => b.date.slice(5));
  const touchedRuns = data.runHistory.filter((r) => r.touched);

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">History & metrics</h2>
          <p className="mt-1 text-xs text-slate-500">
            {data.windowDays}d · {touchedRuns.length} asset-touched runs · {data.metrics.totals.rowsLoaded > 0 ? `${formatRows(data.metrics.totals.rowsLoaded)} rows` : "no row telemetry yet"}
          </p>
        </div>
        <div className="flex gap-1 rounded-lg border border-slate-200 p-0.5 text-xs dark:border-slate-700">
          <button
            type="button"
            onClick={() => setTab("runs")}
            className={`rounded-md px-2.5 py-1 ${tab === "runs" ? "bg-sky-100 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "text-slate-600"}`}
          >
            Runs
          </button>
          <button
            type="button"
            onClick={() => setTab("activity")}
            className={`rounded-md px-2.5 py-1 ${tab === "activity" ? "bg-sky-100 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200" : "text-slate-600"}`}
          >
            All events
          </button>
        </div>
      </div>

      {data.metrics.buckets.length > 1 ? (
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <BarChart
            days={chartDays}
            values={data.metrics.buckets.map((b) => b.rowsLoaded)}
            label="Rows loaded (asset) per day"
            barClass="fill-emerald-500 dark:fill-emerald-400"
            formatter={formatRows}
          />
          <BarChart
            days={chartDays}
            values={data.metrics.buckets.map((b) => b.runs)}
            label="Runs touching this asset"
            barClass="fill-sky-500 dark:fill-sky-400"
          />
        </div>
      ) : null}

      {tab === "runs" ? (
        <div className="mt-4 overflow-x-auto">
          <table className="min-w-full text-xs">
            <thead>
              <tr className="text-left text-slate-500">
                <th className="py-2 pr-3">When</th>
                <th className="py-2 pr-3">Status</th>
                <th className="py-2 pr-3">Slice</th>
                <th className="py-2 pr-3">Rows</th>
                <th className="py-2 pr-3">Duration</th>
                <th className="py-2" />
              </tr>
            </thead>
            <tbody>
              {data.runHistory.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-6 text-center text-slate-500">
                    No runs in this window.
                  </td>
                </tr>
              ) : (
                data.runHistory.slice(0, 25).map((run) => (
                  <tr key={run.runId} className="border-t border-slate-100 dark:border-slate-800">
                    <td className="py-2 pr-3 whitespace-nowrap text-slate-700 dark:text-slate-300">
                      {new Date(run.startedAt).toLocaleString()}
                    </td>
                    <td className="py-2 pr-3 capitalize">
                      <span className={run.touched ? "" : "text-slate-400"}>{run.status}</span>
                      {!run.touched ? (
                        <span className="ml-1 text-[10px] text-slate-400">pipeline only</span>
                      ) : null}
                    </td>
                    <td className="py-2 pr-3 font-mono text-slate-600 dark:text-slate-400">
                      {run.partitionValue ?? "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono">
                      {run.rowsLoaded !== null ? formatRows(run.rowsLoaded) : "—"}
                    </td>
                    <td className="py-2 pr-3 font-mono">{formatDurationMs(run.durationMs)}</td>
                    <td className="py-2">
                      <Link href={`/runs?run=${run.runId}`} className="text-sky-600 hover:underline dark:text-sky-400">
                        View
                      </Link>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      ) : (
        <ul className="mt-4 max-h-80 space-y-2 overflow-y-auto">
          {data.activity.length === 0 ? (
            <li className="text-sm text-slate-500">No activity yet.</li>
          ) : (
            data.activity.slice(0, 40).map((ev) => {
              const Icon = EVENT_ICONS[ev.type];
              const inner = (
                <>
                  <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <StatusDot status={ev.status} />
                      <span className="text-sm font-medium text-slate-900 dark:text-white">{ev.title}</span>
                      <span className="text-[10px] text-slate-400">{new Date(ev.at).toLocaleString()}</span>
                    </div>
                    {ev.detail ? (
                      <p className="mt-0.5 truncate text-xs text-slate-500">{ev.detail}</p>
                    ) : null}
                  </div>
                </>
              );
              return (
                <li key={ev.id}>
                  {ev.href ? (
                    <a
                      href={ev.href}
                      target={ev.type === "github" ? "_blank" : undefined}
                      rel={ev.type === "github" ? "noreferrer" : undefined}
                      className="flex gap-2 rounded-lg px-2 py-1.5 hover:bg-slate-50 dark:hover:bg-slate-800/50"
                    >
                      {inner}
                    </a>
                  ) : (
                    <div className="flex gap-2 rounded-lg px-2 py-1.5">{inner}</div>
                  )}
                </li>
              );
            })
          )}
        </ul>
      )}

      {data.github.commits.length > 0 ? (
        <p className="mt-4 text-xs text-slate-500">
          <GitBranch className="mr-1 inline h-3.5 w-3.5" aria-hidden />
          {data.github.commits.length} recent Git commit(s) on pipeline declaration — see All events tab.
        </p>
      ) : null}
    </section>
  );
}
