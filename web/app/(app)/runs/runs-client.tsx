"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  ClipboardCopy,
  ExternalLink,
  Layers,
  Loader2,
  Play,
  RefreshCw,
  Waypoints,
  Webhook,
  X,
  XCircle,
} from "lucide-react";
import { RunTelemetryTableCells, RunTelemetryView } from "@/components/elt/run-telemetry-view";
import { formatBytes, formatRows, parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { RelatedLinks } from "@/components/ui/related-links";
import { BarChart } from "@/components/ui/bar-chart";
type PipelineOpt = { id: string; name: string };

type RunRow = {
  id: string;
  status: string;
  environment: string;
  correlationId: string;
  triggeredBy: string | null;
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

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState("");
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

  const loadRuns = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const q = new URLSearchParams();
      if (pipelineId) q.set("pipelineId", pipelineId);
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
  }, [pipelineId, statusFilter, environmentFilter]);

  useEffect(() => {
    void loadRuns();
  }, [loadRuns]);

  useEffect(() => {
    if (typeof statusFromUrl === "string" && statusFromUrl.length > 0) {
      setStatusFilter(statusFromUrl);
    }
  }, [statusFromUrl]);

  const activeRunCount = runs.filter((r) => r.status === "pending" || r.status === "running").length;

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
    router.push(`/runs?run=${encodeURIComponent(id)}`, { scroll: false });
  }

  function closeDetail() {
    router.push("/runs", { scroll: false });
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
          List and filter executions per pipeline (newest first). Push <strong className="font-medium text-slate-800 dark:text-slate-200">live telemetry</strong>{" "}
          (rows, bytes, progress, phase) via the same PATCH as logs — gateway and managed workers use identical fields.
          Logs are structured and scrubbed — we never store raw warehouse credentials. Telemetry is stored here whether
          ingestion runs on{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">your gateway</strong>,{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">eltPulse-managed</strong> compute (when
          enabled), or the <strong className="font-medium text-slate-800 dark:text-slate-200">app / API</strong>. Share
          the <strong className="font-medium text-slate-800 dark:text-slate-200">correlation ID</strong> with your
          runner or CI for support. Optional webhooks fire when a run reaches a terminal state.
        </p>
        <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
          Schedules and sensors don&apos;t live here — they trigger runs elsewhere (in eltPulse or in an external
          orchestrator). See{" "}
          <Link href="/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Orchestration
          </Link>{" "}
          for how definitions stay separate from scheduling, and why you can run the same exports on or off platform.
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
            href="/runs?status=running"
            className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
          >
            Running only
          </Link>
        </div>
      )}

      <div className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-3 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300">
        <Webhook className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
        <span>
          Want to fire a webhook when a run finishes?{" "}
          <Link href="/webhooks" className="inline-flex items-center gap-0.5 font-medium text-sky-600 hover:underline dark:text-sky-400">
            Manage webhooks <ExternalLink className="h-3 w-3" />
          </Link>
          {" "}— account default and per-pipeline overrides, decoupled from runs.
        </span>
      </div>

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
        <div className="mt-3 flex flex-wrap gap-4">
          <label className="block">
            <span className="text-xs text-slate-500">Pipeline</span>
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
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
          No runs yet. Connect your runner to the API (same session or future API tokens) or click{" "}
          <strong className="font-medium">Record sample run</strong> to seed demo data.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[900px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Pipeline</th>
                <th className="px-3 py-2 font-medium">Gateway</th>
                <th className="px-3 py-2 font-medium">Environment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Progress</th>
                <th className="px-3 py-2 font-medium">Rows</th>
                <th className="px-3 py-2 font-medium">Bytes</th>
                <th className="px-3 py-2 font-medium">Source</th>
                <th className="px-3 py-2 font-medium">Correlation ID</th>
                <th className="px-3 py-2 font-medium" />
              </tr>
            </thead>
            <tbody>
              {runs.map((r) => (
                <tr key={r.id} className="border-b border-slate-100 dark:border-slate-800">
                  <td className="whitespace-nowrap px-3 py-2 text-slate-600 dark:text-slate-400">
                    {new Date(r.startedAt).toLocaleString()}
                  </td>
                  <td className="px-3 py-2 font-medium text-slate-900 dark:text-white">{r.pipeline.name}</td>
                  <td className="max-w-[140px] truncate px-3 py-2 text-slate-600 dark:text-slate-300" title={r.targetAgentToken?.name ?? "Any gateway"}>
                    {r.targetAgentToken?.name ?? "Any"}
                  </td>
                  <td className="px-3 py-2 text-slate-600 dark:text-slate-300">{r.environment}</td>
                  <td className="px-3 py-2">
                    <span className="inline-flex items-center gap-1.5">
                      <StatusGlyph status={r.status} />
                      <span className="capitalize">{r.status}</span>
                    </span>
                  </td>
                  <RunTelemetryTableCells telemetryRaw={r.telemetry} />
                  <td className="whitespace-nowrap px-3 py-2 text-xs text-slate-600 dark:text-slate-400">
                    {telemetrySourceLabel(r.ingestionExecutor ?? "unspecified")}
                  </td>
                  <td className="max-w-[200px] truncate px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                    {r.correlationId}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <button
                      type="button"
                      onClick={() => void openDetail(r.id)}
                      className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Details <ChevronRight className="h-4 w-4" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
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
                  <span className="text-slate-500">{detail.run.pipeline.name}</span>
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
