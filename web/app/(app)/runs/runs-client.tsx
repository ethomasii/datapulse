"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Waypoints,
  Webhook,
  X,
  XCircle,
} from "lucide-react";
import { RunTelemetryCompactCell, RunTelemetryView } from "@/components/elt/run-telemetry-view";
import { formatBytes, formatRows, parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { RelatedLinks } from "@/components/ui/related-links";
import { BarChart } from "@/components/ui/bar-chart";
import { parseSliceFromTriggeredBy } from "@/lib/elt/slice-trigger";

type PipelineOpt = { id: string; name: string };

type RunRow = {
  id: string;
  status: string;
  environment: string;
  correlationId: string;
  triggeredBy: string | null;
  partitionColumn?: string | null;
  partitionValue?: string | null;
  ingestionExecutor?: string;
  startedAt: string;
  finishedAt: string | null;
  errorSummary: string | null;
  webhookStatus: string | null;
  telemetry?: unknown;
  pipeline: { id: string; name: string };
  targetAgentToken?: { id: string; name: string } | null;
};

function telemetrySourceLabel(executor: string) {
  switch (executor) {
    case "customer_agent":
      return "Your gateway";
    case "eltpulse_managed":
      return "eltPulse";
    case "customer_control_plane":
      return "App / API";
    case "unspecified":
    default:
      return "—";
  }
}

const STATUS_OPTIONS = ["pending", "running", "succeeded", "failed", "cancelled"] as const;

type SortCol = "startedAt" | "pipeline" | "status" | "environment" | "rows";
type SortDir = "asc" | "desc";

function SortIcon({ col, sortCol, sortDir }: { col: SortCol; sortCol: SortCol; sortDir: SortDir }) {
  if (col !== sortCol) return <ArrowUpDown className="ml-1 inline h-3 w-3 text-slate-400" />;
  return sortDir === "asc"
    ? <ArrowUp className="ml-1 inline h-3 w-3 text-sky-600" />
    : <ArrowDown className="ml-1 inline h-3 w-3 text-sky-600" />;
}

function SliceCell({
  triggeredBy,
  partitionColumn,
  partitionValue,
}: {
  triggeredBy: string | null;
  partitionColumn?: string | null;
  partitionValue?: string | null;
}) {
  const parsed = parseSliceFromTriggeredBy(triggeredBy);
  if (parsed) {
    return (
      <span className="font-mono text-xs text-teal-700 dark:text-teal-300" title={`${parsed.column} = ${parsed.value}`}>
        {parsed.value}
      </span>
    );
  }
  const pv = partitionValue?.trim();
  if (pv) {
    const pc = partitionColumn?.trim();
    return (
      <span className="font-mono text-xs text-teal-700 dark:text-teal-300" title={pc ? `${pc} = ${pv}` : pv}>
        {pv}
      </span>
    );
  }
  if (!triggeredBy) {
    return <span className="text-xs text-slate-400 dark:text-slate-500">—</span>;
  }
  return (
    <span
      className="block max-w-[140px] truncate font-mono text-[11px] text-slate-500 dark:text-slate-400"
      title={triggeredBy}
    >
      {triggeredBy}
    </span>
  );
}

function StatusGlyph({ status }: { status: string }) {
  switch (status) {
    case "succeeded":
      return <CheckCircle2 className="h-4 w-4 text-emerald-600" aria-hidden />;
    case "failed":
      return <XCircle className="h-4 w-4 text-red-600" aria-hidden />;
    case "running":
    case "pending":
      return <Loader2 className="h-4 w-4 animate-spin text-sky-600" aria-hidden />;
    default:
      return <AlertCircle className="h-4 w-4 text-slate-500" aria-hidden />;
  }
}

export function RunsClient({ initialPipelines }: { initialPipelines: PipelineOpt[] }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const runIdFromUrl = searchParams.get("run");
  const statusFromUrl = searchParams.get("status");

  const pipelineIds = useMemo(() => new Set(initialPipelines.map((p) => p.id)), [initialPipelines]);
  /** Pipeline filter from `?pipeline=` when it matches a known pipeline. */
  const pipelineFilterId = useMemo(() => {
    const raw = searchParams.get("pipeline");
    if (!raw || !pipelineIds.has(raw)) return "";
    return raw;
  }, [searchParams, pipelineIds]);

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [detail, setDetail] = useState<{
    run: RunRow & {
      logEntries: unknown;
      telemetry?: unknown;
      updatedAt: string;
    };
  } | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);
  const [cancellingIds, setCancellingIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const selectAllRef = useRef<HTMLInputElement>(null);
  const [sortCol, setSortCol] = useState<SortCol>("startedAt");
  const [sortDir, setSortDir] = useState<SortDir>("desc");

  function toggleSort(col: SortCol) {
    setSortCol((prev) => {
      if (prev === col) {
        setSortDir((d) => (d === "asc" ? "desc" : "asc"));
        return col;
      }
      setSortDir("desc");
      return col;
    });
  }

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (pipelineFilterId) q.set("pipelineId", pipelineFilterId);
      if (statusFilter) q.set("status", statusFilter);
      if (environmentFilter.trim()) q.set("environment", environmentFilter.trim());
      const res = await fetch(`/api/elt/runs?${q.toString()}`);
      if (!res.ok) throw new Error(await res.text());
      const data = await res.json();
      setRuns(data.runs ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load runs");
    } finally {
      setLoading(false);
    }
  }, [pipelineFilterId, statusFilter, environmentFilter]);

  function runsPathWithQuery(next: URLSearchParams) {
    const s = next.toString();
    return s ? `/runs?${s}` : "/runs";
  }

  function setPipelineFilterInUrl(nextPipelineId: string) {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("run");
    if (nextPipelineId) q.set("pipeline", nextPipelineId);
    else q.delete("pipeline");
    router.replace(runsPathWithQuery(q), { scroll: false });
  }

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    setSelectedIds(new Set());
  }, [pipelineFilterId, statusFilter, environmentFilter]);

  useEffect(() => {
    if (typeof statusFromUrl === "string" && statusFromUrl.length > 0) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);

  const activeRunCount = runs.filter((r) => r.status === "pending" || r.status === "running").length;

  const sortedRuns = useMemo(() => {
    return [...runs].sort((a, b) => {
      let cmp = 0;
      switch (sortCol) {
        case "startedAt":
          cmp = new Date(a.startedAt).getTime() - new Date(b.startedAt).getTime();
          break;
        case "pipeline":
          cmp = a.pipeline.name.localeCompare(b.pipeline.name);
          break;
        case "status":
          cmp = a.status.localeCompare(b.status);
          break;
        case "environment":
          cmp = a.environment.localeCompare(b.environment);
          break;
        case "rows": {
          const aRows = parseRunTelemetry(a.telemetry).summary.rowsLoaded ?? 0;
          const bRows = parseRunTelemetry(b.telemetry).summary.rowsLoaded ?? 0;
          cmp = aRows - bRows;
          break;
        }
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }, [runs, sortCol, sortDir]);

  const cancellableIdsInList = useMemo(
    () => sortedRuns.filter((r) => r.status === "pending" || r.status === "running").map((r) => r.id),
    [sortedRuns]
  );

  useEffect(() => {
    const el = selectAllRef.current;
    if (!el) return;
    const n = cancellableIdsInList.filter((id) => selectedIds.has(id)).length;
    el.indeterminate = n > 0 && n < cancellableIdsInList.length;
  }, [cancellableIdsInList, selectedIds]);

  useEffect(() => {
    if (!runIdFromUrl) {
      setDetail(null);
      return;
    }
    let cancelled = false;
    (async () => {
      setDetailLoading(true);
      try {
        const res = await fetch(`/api/elt/runs/${runIdFromUrl}`);
        if (!res.ok) return;
        const data = await res.json();
        if (!cancelled) setDetail({ run: data.run });
      } finally {
        if (!cancelled) setDetailLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [runIdFromUrl]);

  async function openDetail(id: string) {
    const q = new URLSearchParams(searchParams.toString());
    q.set("run", id);
    router.push(runsPathWithQuery(q), { scroll: false });
  }

  function closeDetail() {
    const q = new URLSearchParams(searchParams.toString());
    q.delete("run");
    router.replace(runsPathWithQuery(q), { scroll: false });
  }

  async function cancelRun(id: string) {
    const next = new Set(cancellingIds);
    next.add(id);
    setCancellingIds(next);
    try {
      const res = await fetch(`/api/elt/runs/${id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "cancelled" }),
      });
      if (!res.ok) throw new Error(await res.text());
      setSelectedIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to cancel run");
    } finally {
      setCancellingIds((prev) => {
        const s = new Set(prev);
        s.delete(id);
        return s;
      });
    }
  }

  async function cancelSelectedRuns() {
    const ids = Array.from(selectedIds).filter((id) => {
      const r = runs.find((x) => x.id === id);
      return r && (r.status === "pending" || r.status === "running");
    });
    if (ids.length === 0) return;
    setError(null);
    setCancellingIds((prev) => {
      const s = new Set(prev);
      ids.forEach((id) => s.add(id));
      return s;
    });
    try {
      const results = await Promise.allSettled(
        ids.map((id) =>
          fetch(`/api/elt/runs/${id}`, {
            method: "PATCH",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ status: "cancelled" }),
          }).then(async (res) => {
            if (!res.ok) throw new Error(await res.text());
          })
        )
      );
      const failed = results.filter((r) => r.status === "rejected").length;
      if (failed > 0) {
        setError(`${failed} of ${ids.length} run(s) could not be cancelled. Try refreshing.`);
      }
      setSelectedIds(new Set());
      await loadRuns();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Bulk cancel failed");
    } finally {
      setCancellingIds((prev) => {
        const s = new Set(prev);
        ids.forEach((id) => s.delete(id));
        return s;
      });
    }
  }

  function toggleSelectAll() {
    const list = cancellableIdsInList;
    if (list.length === 0) return;
    const allOn = list.every((id) => selectedIds.has(id));
    if (allOn) setSelectedIds(new Set());
    else setSelectedIds(new Set(list));
  }

  function toggleRowSelect(id: string) {
    setSelectedIds((prev) => {
      const s = new Set(prev);
      if (s.has(id)) s.delete(id);
      else s.add(id);
      return s;
    });
  }

  async function runDemo() {
    const p = initialPipelines[0];
    if (!p) return;
    setDemoBusy(true);
    setError(null);
    try {
      // Randomize metrics so each sample run looks distinct
      const totalRows = Math.floor(Math.random() * 90_000) + 5_000;
      const totalBytes = Math.floor(totalRows * (Math.random() * 200 + 100));
      const midRows = Math.floor(totalRows * (0.35 + Math.random() * 0.25));
      const midBytes = Math.floor(totalBytes * (0.35 + Math.random() * 0.25));
      const midProgress = Math.floor(40 + Math.random() * 25);
      const phases = ["orders", "customers", "products", "events", "sessions", "transactions"];
      const resource = phases[Math.floor(Math.random() * phases.length)];
      const environments = ["demo", "staging", "dev"];
      const env = environments[Math.floor(Math.random() * environments.length)];

      const create = await fetch("/api/elt/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: p.id,
          environment: env,
          triggeredBy: "manual:sample",
          status: "running",
        }),
      });
      if (!create.ok) throw new Error(await create.text());
      const { run } = (await create.json()) as { run: { id: string } };

      const assertPatchOk = async (res: Response, step: string) => {
        if (!res.ok) {
          const body = await res.text();
          throw new Error(`${step} failed (${res.status}): ${body.slice(0, 400)}`);
        }
      };

      const patch1 = await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "running",
          appendLog: { level: "info", message: `Starting sync on ${resource} (sample run).` },
          telemetrySummary: { currentPhase: "extract", currentResource: resource, progress: 5 },
          appendTelemetrySample: { progress: 5, rows: 0, bytes: 0, phase: "extract", resource },
        }),
      });
      await assertPatchOk(patch1, "Sample run step 1");
      const patch2 = await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendLog: { level: "info", message: `Rows processed so far: ${midRows.toLocaleString()} (sample).` },
          telemetrySummary: { currentPhase: "load", currentResource: resource, progress: midProgress, rowsLoaded: midRows, bytesLoaded: midBytes },
          appendTelemetrySample: { progress: midProgress, rows: midRows, bytes: midBytes, phase: "load", resource },
        }),
      });
      await assertPatchOk(patch2, "Sample run step 2");
      const patch3 = await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "succeeded",
          appendLog: { level: "info", message: `Completed successfully. ${totalRows.toLocaleString()} rows loaded.` },
          telemetrySummary: { currentPhase: "done", currentResource: resource, progress: 100, rowsLoaded: totalRows, bytesLoaded: totalBytes },
          appendTelemetrySample: { progress: 100, rows: totalRows, bytes: totalBytes, phase: "done", resource },
        }),
      });
      await assertPatchOk(patch3, "Sample run step 3");
      await loadRuns();
      await openDetail(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo failed");
    } finally {
      setDemoBusy(false);
    }
  }

  // Build 14-day chart data from the loaded runs
  const CHART_DAYS = 14;
  const chartDays = (() => {
    const days: string[] = [];
    for (let i = CHART_DAYS - 1; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toLocaleDateString(undefined, { month: "short", day: "numeric" }));
    }
    return days;
  })();
  const runsPerDay = Object.fromEntries(chartDays.map((d) => [d, 0]));
  const rowsPerDay = Object.fromEntries(chartDays.map((d) => [d, 0]));
  for (const r of runs) {
    const key = new Date(r.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    if (key in runsPerDay) runsPerDay[key]++;
    const { summary } = parseRunTelemetry(r.telemetry);
    if (summary.rowsLoaded && key in rowsPerDay) rowsPerDay[key] += summary.rowsLoaded;
  }
  const chartRunValues = chartDays.map((d) => runsPerDay[d]);
  const chartRowValues = chartDays.map((d) => rowsPerDay[d]);
  const hasChartData = runs.some((r) => {
    const key = new Date(r.startedAt).toLocaleDateString(undefined, { month: "short", day: "numeric" });
    return key in runsPerDay;
  });

  return (
    <div className="w-full min-w-0 max-w-7xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Runs</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Filter and inspect pipeline executions. Jump from{" "}
          <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Pipelines
          </Link>{" "}
          with <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">?pipeline=…</code> for one
          line&apos;s history. Open <strong className="font-medium text-slate-800 dark:text-slate-200">Details</strong>{" "}
          for correlation ID, full telemetry, and logs. Schedules live under{" "}
          <Link href="/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Orchestration
          </Link>
          ; webhooks under{" "}
          <Link href="/webhooks" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Webhooks
          </Link>
          .{" "}
          <Link href="/docs/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Runs docs →
          </Link>
        </p>
      </div>

      {/* 14-day activity charts */}
      {hasChartData && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Activity — last {CHART_DAYS} days</h2>
            <span className="text-xs text-slate-400 dark:text-slate-500">Based on current filter</span>
          </div>
          <div className="grid gap-6 lg:grid-cols-2">
            <BarChart days={chartDays} values={chartRunValues} label="Runs per day" barClass="fill-sky-500 dark:fill-sky-400" formatter={(n) => n.toString()} />
            <BarChart days={chartDays} values={chartRowValues} label="Rows ingested per day" barClass="fill-emerald-500 dark:fill-emerald-400" formatter={formatRows} />
          </div>
        </section>
      )}

      {activeRunCount > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
          <span>
            <strong className="font-semibold">{activeRunCount}</strong> run{activeRunCount === 1 ? "" : "s"} currently{" "}
            <span className="font-medium">pending or running</span> — open details for live charts when your runner sends
            samples.
          </span>
          <Link
            href={(() => {
              const q = new URLSearchParams();
              if (pipelineFilterId) q.set("pipeline", pipelineFilterId);
              q.set("status", "running");
              return `/runs?${q}`;
            })()}
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
          >
            Running only
          </Link>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/builder"
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
        >
          <Play className="h-4 w-4" />
          {initialPipelines.length === 0 ? "Create a pipeline first" : "New pipeline"}
        </Link>
        {initialPipelines.length > 0 ? (
          <button
            type="button"
            onClick={() => void runDemo()}
            disabled={demoBusy}
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
          >
            {demoBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Record sample run
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => {
            void loadRuns();
          }}
          className="inline-flex items-center gap-2 text-sm text-sky-600 hover:underline dark:text-sky-400"
        >
          <RefreshCw className="h-4 w-4" /> Refresh
        </button>
      </div>

      <section className="rounded-2xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Filters</h2>
        {pipelineFilterId ? (
          <div className="mt-2 space-y-2">
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Showing runs for{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">
                {initialPipelines.find((p) => p.id === pipelineFilterId)?.name ?? "this pipeline"}
              </strong>
              .{" "}
              <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                Clear pipeline filter
              </Link>
            </p>
            <div className="rounded-lg border border-teal-200 bg-teal-50/80 px-3 py-2 text-xs text-teal-950 dark:border-teal-800 dark:bg-teal-950/25 dark:text-teal-100">
              <strong className="font-medium">Latest per slice:</strong> one row per slice value (backfill runs only),
              missing days, re-run failed — open{" "}
              <Link
                href={`/run-slices?pipeline=${encodeURIComponent(pipelineFilterId)}`}
                className="font-semibold text-teal-800 underline hover:no-underline dark:text-teal-200"
              >
                Run slices — coverage
              </Link>
              .
            </div>
          </div>
        ) : null}
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="block">
            <span className="text-xs text-slate-500">Pipeline</span>
            <select
              value={pipelineFilterId}
              onChange={(e) => setPipelineFilterInUrl(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            >
              <option value="">All pipelines</option>
              {initialPipelines.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Status</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="mt-1 block rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            >
              <option value="">Any</option>
              {STATUS_OPTIONS.map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="block">
            <span className="text-xs text-slate-500">Environment</span>
            <input
              value={environmentFilter}
              onChange={(e) => setEnvironmentFilter(e.target.value)}
              placeholder="e.g. prod, demo"
              className="mt-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </div>
      </section>

      {/* Aggregate stats strip */}
      {!loading && runs.length > 0 && (() => {
        const succeeded = runs.filter((r) => r.status === "succeeded").length;
        const failed = runs.filter((r) => r.status === "failed").length;
        const active = runs.filter((r) => r.status === "pending" || r.status === "running").length;
        let totalRows = 0;
        let totalBytes = 0;
        for (const r of runs) {
          const { summary } = parseRunTelemetry(r.telemetry);
          if (summary.rowsLoaded) totalRows += summary.rowsLoaded;
          if (summary.bytesLoaded) totalBytes += summary.bytesLoaded;
        }
        const successRate = runs.length > 0 ? Math.round((succeeded / runs.length) * 100) : 0;
        const stats = [
          { label: "Showing", value: runs.length.toString() },
          { label: "Succeeded", value: succeeded.toString(), highlight: "text-emerald-700 dark:text-emerald-400" },
          { label: "Failed", value: failed.toString(), highlight: failed > 0 ? "text-red-600 dark:text-red-400" : undefined },
          { label: "Active", value: active.toString(), highlight: active > 0 ? "text-sky-600 dark:text-sky-400" : undefined },
          { label: "Success rate", value: `${successRate}%` },
          { label: "Total rows", value: formatRows(totalRows) },
          { label: "Total bytes", value: formatBytes(totalBytes) },
        ];
        return (
          <div className="flex flex-wrap gap-3">
            {stats.map(({ label, value, highlight }) => (
              <div key={label} className="rounded-lg border border-slate-200 bg-white px-4 py-2 dark:border-slate-700 dark:bg-slate-900">
                <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{label}</div>
                <div className={`mt-0.5 font-mono text-sm font-semibold ${highlight ?? "text-slate-900 dark:text-white"}`}>{value}</div>
              </div>
            ))}
          </div>
        );
      })()}

      {error && (
        <p className="text-sm text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-slate-500">Loading runs…</p>
      ) : runs.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 p-8 text-center text-slate-600 dark:border-slate-700 dark:text-slate-400">
          {pipelineFilterId ? (
            <>
              No runs yet for this pipeline. Trigger a run from your gateway or orchestrator, or use{" "}
              <Link href="/run-slices" className="font-medium text-teal-600 hover:underline dark:text-teal-400">
                Run slices
              </Link>{" "}
              for backfills.
            </>
          ) : (
            <>
              No runs yet. Connect your runner to the API (same session or future API tokens) or click{" "}
              <strong className="font-medium">Record sample run</strong> to seed demo data.
            </>
          )}
        </p>
      ) : (
        <>
          {selectedIds.size > 0 && (
            <div className="flex flex-wrap items-center gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
              <span>
                <strong className="font-semibold">{selectedIds.size}</strong> selected
              </span>
              <button
                type="button"
                onClick={() => void cancelSelectedRuns()}
                disabled={Array.from(selectedIds).some((id) => cancellingIds.has(id))}
                className="inline-flex items-center gap-1.5 rounded-lg bg-red-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-red-500 disabled:opacity-50"
              >
                Cancel selected
              </button>
              <button
                type="button"
                onClick={() => setSelectedIds(new Set())}
                className="text-xs font-medium text-amber-900 underline hover:no-underline dark:text-amber-100"
              >
                Clear selection
              </button>
            </div>
          )}
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full min-w-0 text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                <tr>
                  <th className="sticky left-0 z-20 w-[200px] min-w-[180px] border-r border-slate-200 bg-slate-50 px-2 py-2 text-left align-bottom dark:border-slate-700 dark:bg-slate-900">
                    <div className="flex items-center gap-2">
                      <input
                        ref={selectAllRef}
                        type="checkbox"
                        className="h-4 w-4 shrink-0 rounded border-slate-300 text-sky-600 focus:ring-sky-500 disabled:opacity-40 dark:border-slate-600"
                        checked={
                          cancellableIdsInList.length > 0 &&
                          cancellableIdsInList.every((id) => selectedIds.has(id))
                        }
                        disabled={cancellableIdsInList.length === 0}
                        onChange={toggleSelectAll}
                        title="Select all pending / running runs in this list"
                        aria-label="Select all cancellable runs"
                      />
                      <span className="text-xs font-semibold uppercase tracking-wide text-slate-600 dark:text-slate-400">
                        Actions
                      </span>
                    </div>
                  </th>
                  {(["startedAt", "pipeline", "environment", "status"] as SortCol[]).map((col) => (
                    <th key={col} className="px-3 py-2 font-medium">
                      <button
                        type="button"
                        onClick={() => toggleSort(col)}
                        className="inline-flex items-center whitespace-nowrap hover:text-sky-600"
                      >
                        {col === "startedAt"
                          ? "Started"
                          : col === "pipeline"
                            ? "Pipeline"
                            : col === "environment"
                              ? "Environment"
                              : "Status"}
                        <SortIcon col={col} sortCol={sortCol} sortDir={sortDir} />
                      </button>
                    </th>
                  ))}
                  <th className="px-3 py-2 font-medium text-slate-600 dark:text-slate-400">Slice</th>
                  <th className="px-3 py-2 font-medium">Gateway</th>
                  <th className="px-3 py-2 font-medium">
                    <button type="button" onClick={() => toggleSort("rows")} className="inline-flex items-center hover:text-sky-600">
                      Progress / loads
                      <SortIcon col="rows" sortCol={sortCol} sortDir={sortDir} />
                    </button>
                  </th>
                </tr>
              </thead>
              <tbody>
                {sortedRuns.map((r) => {
                  const cancellable = r.status === "pending" || r.status === "running";
                  return (
                    <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                      <td className="sticky left-0 z-10 border-r border-slate-100 bg-white px-2 py-2 align-top dark:border-slate-800 dark:bg-slate-950">
                        <div className="flex gap-2">
                          <div className="flex w-5 shrink-0 justify-center pt-0.5">
                            {cancellable ? (
                              <input
                                type="checkbox"
                                className="h-4 w-4 rounded border-slate-300 text-sky-600 focus:ring-sky-500 dark:border-slate-600"
                                checked={selectedIds.has(r.id)}
                                onChange={() => toggleRowSelect(r.id)}
                                aria-label={`Select run ${r.pipeline.name}`}
                              />
                            ) : null}
                          </div>
                          <div className="flex min-w-0 flex-col gap-1">
                            {cancellable ? (
                              <button
                                type="button"
                                disabled={cancellingIds.has(r.id)}
                                onClick={() => void cancelRun(r.id)}
                                className="inline-flex items-center gap-1 text-left text-xs font-medium text-red-600 hover:underline disabled:opacity-50 dark:text-red-400"
                                title="Cancel this run"
                              >
                                {cancellingIds.has(r.id) ? (
                                  <Loader2 className="h-3 w-3 shrink-0 animate-spin" />
                                ) : (
                                  <X className="h-3 w-3 shrink-0" />
                                )}
                                Cancel
                              </button>
                            ) : null}
                            <button
                              type="button"
                              onClick={() => void openDetail(r.id)}
                              className="inline-flex items-center gap-1 text-left text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                            >
                              Details <ChevronRight className="h-3.5 w-3.5 shrink-0" />
                            </button>
                          </div>
                        </div>
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                        {new Date(r.startedAt).toLocaleString()}
                      </td>
                      <td className="max-w-[min(200px,28vw)] truncate px-3 py-2 font-medium text-slate-900 dark:text-white" title={r.pipeline.name}>
                        {r.pipeline.name}
                      </td>
                      <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-300">{r.environment}</td>
                      <td className="whitespace-nowrap px-3 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          <StatusGlyph status={r.status} />
                          <span className="capitalize">{r.status}</span>
                        </span>
                      </td>
                      <td className="max-w-[120px] px-3 py-2 align-top sm:max-w-[160px]">
                        <SliceCell
                          triggeredBy={r.triggeredBy}
                          partitionColumn={r.partitionColumn}
                          partitionValue={r.partitionValue}
                        />
                      </td>
                      <td
                        className="max-w-[100px] truncate px-3 py-2 text-xs text-slate-600 dark:text-slate-300 sm:max-w-[140px]"
                        title={r.targetAgentToken?.name ?? "Any gateway"}
                      >
                        {r.targetAgentToken?.name ?? "Any"}
                      </td>
                      <RunTelemetryCompactCell telemetryRaw={r.telemetry} />
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      )}

      <RelatedLinks links={[
        { href: "/builder", icon: Layers, label: "Pipelines", desc: "Create or edit source → destination connections" },
        { href: "/orchestration", icon: Play, label: "Orchestration", desc: "Schedule sensors that trigger these runs" },
        { href: "/gateway", icon: Waypoints, label: "Gateway & execution", desc: "Connect your runner or use eltPulse-managed workers" },
        { href: "/webhooks", icon: Webhook, label: "Webhooks", desc: "Fire notifications when a run reaches a terminal state" },
      ]} />

      {(runIdFromUrl || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="run-detail-title"
          onClick={closeDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-3xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <h2 id="run-detail-title" className="text-lg font-semibold text-slate-900 dark:text-white">
                Run details
              </h2>
              <button
                type="button"
                onClick={closeDetail}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {detailLoading || !detail ? (
              <p className="mt-4 text-slate-500">Loading…</p>
            ) : (
              <div className="mt-4 space-y-4 text-sm">
                {/* Status badges */}
                <div className="flex flex-wrap gap-2">
                  <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs dark:bg-slate-800">
                    <StatusGlyph status={detail.run.status} />
                    {detail.run.status}
                  </span>
                  <span className="inline-flex items-center rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                    Telemetry: {telemetrySourceLabel(detail.run.ingestionExecutor ?? "unspecified")}
                  </span>
                  <span className="text-slate-500">{detail.run.pipeline?.name ?? "Pipeline"}</span>
                  {typeof detail.run.pipeline?.id === "string" && detail.run.pipeline.id.length > 0 ? (
                    <>
                      <Link
                        href={`/runs?pipeline=${encodeURIComponent(detail.run.pipeline.id)}`}
                        className="ml-2 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        All runs for pipeline
                      </Link>
                      <Link
                        href={`/run-slices?pipeline=${encodeURIComponent(detail.run.pipeline.id)}`}
                        className="ml-2 text-xs font-medium text-teal-600 hover:underline dark:text-teal-400"
                        onClick={(e) => e.stopPropagation()}
                      >
                        Slice coverage
                      </Link>
                    </>
                  ) : null}
                  <span className="text-slate-500">· {detail.run.environment}</span>
                  {detail.run.targetAgentToken ? (
                    <span className="text-slate-500">· Gateway: {detail.run.targetAgentToken.name}</span>
                  ) : (
                    <span className="text-slate-500">· Gateway: any</span>
                  )}
                </div>

                {/* Timing info */}
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Started</div>
                    <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
                      {new Date(detail.run.startedAt).toLocaleString()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Finished</div>
                    <div className="mt-0.5 text-xs text-slate-700 dark:text-slate-200">
                      {detail.run.finishedAt ? new Date(detail.run.finishedAt).toLocaleString() : "—"}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Duration</div>
                    <div className="mt-0.5 font-mono text-xs text-slate-700 dark:text-slate-200">
                      {(() => {
                        const end = detail.run.finishedAt ? new Date(detail.run.finishedAt).getTime() : Date.now();
                        const ms = end - new Date(detail.run.startedAt).getTime();
                        if (ms < 0) return "—";
                        const s = Math.floor(ms / 1000);
                        if (s < 60) return `${s}s`;
                        return `${Math.floor(s / 60)}m ${s % 60}s`;
                      })()}
                    </div>
                  </div>
                  <div className="rounded-lg border border-slate-100 bg-slate-50/80 px-3 py-2 dark:border-slate-800 dark:bg-slate-950/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Triggered by</div>
                    <div className="mt-0.5 truncate text-xs text-slate-700 dark:text-slate-200" title={detail.run.triggeredBy ?? "—"}>
                      {detail.run.triggeredBy ?? "—"}
                    </div>
                  </div>
                </div>

                {(Boolean((detail.run as { partitionValue?: string | null }).partitionValue) ||
                  Boolean((detail.run as { partitionColumn?: string | null }).partitionColumn)) && (
                  <div className="rounded-lg border border-teal-100 bg-teal-50/60 px-3 py-2 dark:border-teal-900 dark:bg-teal-950/30">
                    <div className="text-[10px] font-semibold uppercase tracking-wide text-teal-800 dark:text-teal-200">
                      Slice for executor
                    </div>
                    <div className="mt-1 font-mono text-xs text-teal-900 dark:text-teal-100">
                      <span className="text-teal-700 dark:text-teal-300">column:</span>{" "}
                      {(detail.run as { partitionColumn?: string | null }).partitionColumn ?? "—"}{" "}
                      <span className="text-teal-700 dark:text-teal-300">value:</span>{" "}
                      {(detail.run as { partitionValue?: string | null }).partitionValue ?? "—"}
                    </div>
                  </div>
                )}

                {/* Correlation ID */}
                <div>
                  <span className="text-xs font-medium uppercase text-slate-500">Correlation ID</span>
                  <div className="mt-1 flex items-center gap-2">
                    <code className="flex-1 break-all rounded bg-slate-100 px-2 py-1 text-xs dark:bg-slate-950">
                      {detail.run.correlationId}
                    </code>
                    <button
                      type="button"
                      className="rounded p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                      onClick={() => void navigator.clipboard.writeText(detail.run.correlationId)}
                      title="Copy"
                    >
                      <ClipboardCopy className="h-4 w-4" />
                    </button>
                  </div>
                  <p className="mt-1 text-xs text-slate-500">
                    Give this to support with your CI job name so we can trace end-to-end.
                  </p>
                </div>

                {detail.run.errorSummary && (
                  <div>
                    <span className="text-xs font-medium uppercase text-red-600 dark:text-red-400">Error (sanitized)</span>
                    <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-red-50 p-3 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-100">
                      {detail.run.errorSummary}
                    </pre>
                  </div>
                )}

                <RunTelemetryView telemetryRaw={detail.run.telemetry} logEntriesRaw={detail.run.logEntries} />

                <div>
                  <span className="text-xs font-medium uppercase text-slate-500">Structured logs</span>
                  <pre className="mt-1 max-h-64 overflow-auto rounded-lg bg-slate-50 p-3 font-mono text-xs text-slate-800 dark:bg-slate-950 dark:text-slate-200">
                    {JSON.stringify(detail.run.logEntries ?? [], null, 2)}
                  </pre>
                </div>
                {detail.run.webhookStatus && (
                  <p className="text-xs text-slate-500">
                    Webhook delivery: <span className="font-mono">{detail.run.webhookStatus}</span>
                  </p>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
