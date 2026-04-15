"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertCircle, Calendar, CheckCircle2, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import { latestRunPerSlice, parseSliceFromTriggeredBy, type RunRowForSlice } from "@/lib/elt/slice-trigger";

type PipelineOption = {
  id: string;
  name: string;
  sourceType: string;
  partitionConfig?: { type: string; column: string; granularity: string; description: string };
};

function dateRangeDay(start: string, end: string): string[] {
  const dates: string[] = [];
  const s = new Date(start);
  const e = new Date(end);
  if (isNaN(s.getTime()) || isNaN(e.getTime()) || s > e) return dates;
  const cur = new Date(s);
  let limit = 0;
  while (cur <= e && limit < 400) {
    dates.push(cur.toISOString().slice(0, 10));
    cur.setDate(cur.getDate() + 1);
    limit++;
  }
  return dates;
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "succeeded":
      return (
        <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
          <CheckCircle2 className="h-3.5 w-3.5" /> {status}
        </span>
      );
    case "failed":
    case "cancelled":
      return (
        <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
          <XCircle className="h-3.5 w-3.5" /> {status}
        </span>
      );
    case "running":
    case "pending":
      return (
        <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
          <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
        </span>
      );
    default:
      return <span className="capitalize text-slate-600 dark:text-slate-300">{status}</span>;
  }
}

export function SliceCoveragePanel({ pipelines }: { pipelines: PipelineOption[] }) {
  const [pipelineId, setPipelineId] = useState<string>("");
  const [runs, setRuns] = useState<RunRowForSlice[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [launchingKey, setLaunchingKey] = useState<string | null>(null);
  const [manualColumn, setManualColumn] = useState("");
  const [manualValue, setManualValue] = useState("");
  const [gapStart, setGapStart] = useState("");
  const [gapEnd, setGapEnd] = useState("");

  const pipeline = useMemo(() => pipelines.find((p) => p.id === pipelineId) ?? null, [pipelines, pipelineId]);

  useEffect(() => {
    // If the previously selected pipeline was removed, clear the selection.
    if (pipelineId && !pipelines.some((p) => p.id === pipelineId)) {
      setPipelineId("");
    }
  }, [pipelines, pipelineId]);

  const loadRuns = useCallback(async () => {
    if (!pipelineId) return;
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams({ pipelineId, limit: "200" });
      const res = await fetch(`/api/elt/runs?${q}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Failed to load runs");
      const data = (await res.json()) as { runs: RunRowForSlice[] };
      setRuns(Array.isArray(data.runs) ? data.runs : []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
      setRuns([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    const col = pipeline?.partitionConfig?.column?.trim();
    if (col) setManualColumn(col);
  }, [pipeline?.partitionConfig?.column, pipelineId]);

  const sliceMap = useMemo(() => latestRunPerSlice(runs), [runs]);
  const sliceRows = useMemo(() => {
    const rows = Array.from(sliceMap.values());
    rows.sort((a, b) => {
      const vc = a.parsed.value.localeCompare(b.parsed.value, undefined, { numeric: true });
      if (vc !== 0) return vc;
      return a.parsed.column.localeCompare(b.parsed.column);
    });
    return rows;
  }, [sliceMap]);

  const noSliceMetadataCount = useMemo(
    () => runs.filter((r) => !parseSliceFromTriggeredBy(r.triggeredBy)).length,
    [runs]
  );

  const partitionCol = pipeline?.partitionConfig?.column?.trim();
  const isDatePartition = pipeline?.partitionConfig?.type === "date";

  const gapDays = useMemo(() => {
    if (!isDatePartition || !partitionCol || !gapStart || !gapEnd) return [];
    const days = dateRangeDay(gapStart, gapEnd);
    return days.map((day) => {
      const key = `${partitionCol}::${day}`;
      const row = sliceMap.get(key);
      const missing = !row;
      const ok = row?.status === "succeeded";
      return { day, row, missing, ok };
    });
  }, [isDatePartition, partitionCol, gapStart, gapEnd, sliceMap]);

  async function queueSliceRun(column: string, value: string) {
    if (!pipelineId || !column.trim() || !value.trim()) return;
    const key = `${column.trim()}::${value.trim()}`;
    setLaunchingKey(key);
    setError(null);
    try {
      const res = await fetch("/api/elt/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          environment: "backfill",
          triggeredBy: `backfill:partition:${column.trim()}:${value.trim()}`,
          status: "pending",
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: unknown };
        const msg = typeof d.error === "string" ? d.error : JSON.stringify(d.error ?? res.statusText);
        throw new Error(msg);
      }
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunchingKey(null);
    }
  }

  if (pipelines.length === 0) return null;

  return (
    <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400">
            <Calendar className="h-5 w-5" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">Slice coverage</span>
          </div>
          <h2 className="mt-1 text-lg font-semibold text-slate-900 dark:text-white">Runs by slice</h2>
          <p className="mt-2 max-w-3xl text-sm text-slate-600 dark:text-slate-300">
            Pick a pipeline to see each slice that was queued via{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">backfill:partition:…</code>, the latest
            status per slice, and queue a single slice again if it failed or never ran. This matches day-by-day (or
            key-by-key) loads when your runner honors{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">triggeredBy</code>.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void loadRuns()}
          disabled={loading || !pipelineId}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-1.5 text-sm text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
          Refresh
        </button>
      </div>

      <div className="mt-4 flex flex-wrap items-end gap-3">
        <div className="min-w-[200px] flex-1">
          <label className="block text-xs font-medium text-slate-500 dark:text-slate-400">Pipeline</label>
          <select
            value={pipelineId}
            onChange={(e) => setPipelineId(e.target.value)}
            className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="">— Select a pipeline —</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name} ({p.sourceType})
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && (
        <div className="mt-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-800 dark:bg-red-950/30 dark:text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      )}

      {loading && runs.length === 0 ? (
        <div className="mt-6 flex items-center gap-2 text-slate-500">
          <Loader2 className="h-5 w-5 animate-spin" />
          Loading runs…
        </div>
      ) : (
        <>
          <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
            Showing up to 200 most recent runs for this pipeline.{" "}
            {noSliceMetadataCount > 0 ? (
              <>
                {noSliceMetadataCount} run{noSliceMetadataCount !== 1 ? "s" : ""} in this window without{" "}
                <code className="text-[11px]">backfill:partition:…</code> (schedules, manual, etc.).{" "}
              </>
            ) : null}
            <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Open full Runs
            </Link>
          </p>

          <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500 dark:border-slate-700 dark:bg-slate-800/80 dark:text-slate-400">
                  <th className="px-3 py-2">Slice column</th>
                  <th className="px-3 py-2">Slice value</th>
                  <th className="px-3 py-2">Latest status</th>
                  <th className="px-3 py-2">Started</th>
                  <th className="px-3 py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {sliceRows.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-3 py-8 text-center text-slate-500 dark:text-slate-400">
                      No slice backfill runs yet. Use the backfill launcher above (or POST{" "}
                      <code className="text-xs">backfill:partition:…</code>) so each slice appears here.
                    </td>
                  </tr>
                ) : (
                  sliceRows.map((row) => {
                    const k = `${row.parsed.column}::${row.parsed.value}`;
                    const busy = launchingKey === k;
                    return (
                      <tr key={row.id} className="border-b border-slate-100 dark:border-slate-800">
                        <td className="px-3 py-2 font-mono text-xs text-slate-700 dark:text-slate-300">{row.parsed.column}</td>
                        <td className="px-3 py-2 font-mono text-xs text-slate-900 dark:text-white">{row.parsed.value}</td>
                        <td className="px-3 py-2">
                          <StatusBadge status={row.status} />
                        </td>
                        <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                          {new Date(row.startedAt).toLocaleString()}
                        </td>
                        <td className="px-3 py-2 text-right">
                          <div className="flex flex-wrap justify-end gap-2">
                            <Link
                              href={`/runs?run=${encodeURIComponent(row.id)}`}
                              className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                            >
                              Details
                            </Link>
                            <button
                              type="button"
                              disabled={busy}
                              onClick={() => void queueSliceRun(row.parsed.column, row.parsed.value)}
                              className="inline-flex items-center gap-1 rounded border border-teal-200 bg-white px-2 py-1 text-xs font-medium text-teal-800 hover:bg-teal-50 disabled:opacity-50 dark:border-teal-800 dark:bg-slate-900 dark:text-teal-200 dark:hover:bg-teal-950/40"
                            >
                              {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
                              Re-run slice
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-800/40">
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Queue one slice</h3>
            <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
              Run a single slice without using the bulk backfill preview — same as a one-row backfill launch.
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              <div>
                <label className="block text-xs text-slate-500">Partition column</label>
                <input
                  value={manualColumn}
                  onChange={(e) => setManualColumn(e.target.value)}
                  placeholder={partitionCol || "e.g. event_date"}
                  className="mt-1 w-40 rounded border border-slate-300 px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="min-w-[160px] flex-1">
                <label className="block text-xs text-slate-500">Slice value</label>
                <input
                  value={manualValue}
                  onChange={(e) => setManualValue(e.target.value)}
                  placeholder={isDatePartition ? "2024-06-01" : "us-east-1"}
                  className="mt-1 w-full rounded border border-slate-300 px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </div>
              <div className="flex items-end">
                <button
                  type="button"
                  disabled={!manualColumn.trim() || !manualValue.trim() || Boolean(launchingKey)}
                  onClick={() => {
                    void (async () => {
                      await queueSliceRun(manualColumn, manualValue);
                      setManualValue("");
                    })();
                  }}
                  className="inline-flex items-center gap-2 rounded-lg bg-teal-600 px-3 py-2 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50"
                >
                  {launchingKey === `${manualColumn.trim()}::${manualValue.trim()}` ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                  Queue run
                </button>
              </div>
            </div>
          </div>

          {isDatePartition && partitionCol && (
            <div className="mt-6 rounded-xl border border-dashed border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
              <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Day coverage (date slices)</h3>
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                Uses your saved partition column <span className="font-mono">{partitionCol}</span>. Days with no slice
                run, or latest run not succeeded, are highlighted.
              </p>
              <div className="mt-3 flex flex-wrap gap-3">
                <div>
                  <label className="block text-xs text-slate-500">From</label>
                  <input
                    type="date"
                    value={gapStart}
                    onChange={(e) => setGapStart(e.target.value)}
                    className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  />
                </div>
                <div>
                  <label className="block text-xs text-slate-500">To</label>
                  <input
                    type="date"
                    value={gapEnd}
                    onChange={(e) => setGapEnd(e.target.value)}
                    className="mt-1 rounded border border-slate-300 px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  />
                </div>
              </div>
              {gapDays.length > 0 && (
                <ul className="mt-4 max-h-48 space-y-1 overflow-y-auto rounded border border-slate-100 p-2 text-xs dark:border-slate-800">
                  {gapDays.map(({ day, row, missing, ok }) => (
                    <li
                      key={day}
                      className={`flex flex-wrap items-center justify-between gap-2 rounded px-2 py-1 ${
                        missing ? "bg-amber-50 dark:bg-amber-950/30" : ok ? "bg-emerald-50/50 dark:bg-emerald-950/20" : "bg-red-50/60 dark:bg-red-950/20"
                      }`}
                    >
                      <span className="font-mono">{day}</span>
                      <span className="text-slate-600 dark:text-slate-300">
                        {missing ? "No slice run" : row ? <StatusBadge status={row.status} /> : null}
                      </span>
                      {!missing && row && (
                        <button
                          type="button"
                          disabled={launchingKey === `${partitionCol}::${day}`}
                          onClick={() => void queueSliceRun(partitionCol, day)}
                          className="text-teal-700 hover:underline dark:text-teal-400"
                        >
                          Re-run
                        </button>
                      )}
                      {missing && (
                        <button
                          type="button"
                          disabled={launchingKey === `${partitionCol}::${day}`}
                          onClick={() => void queueSliceRun(partitionCol, day)}
                          className="font-medium text-teal-700 hover:underline dark:text-teal-400"
                        >
                          Queue slice
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
