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
  Loader2,
  Play,
  RefreshCw,
  Webhook,
  X,
  XCircle,
} from "lucide-react";
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

  const [runs, setRuns] = useState<RunRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pipelineId, setPipelineId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [environmentFilter, setEnvironmentFilter] = useState("");
  const [detail, setDetail] = useState<{
    run: RunRow & {
      logEntries: unknown;
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
      const create = await fetch("/api/elt/runs", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId: p.id,
          environment: "demo",
          triggeredBy: "manual:sample",
          status: "running",
        }),
      });
      if (!create.ok) throw new Error(await create.text());
      const { run } = (await create.json()) as { run: { id: string } };
      await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendLog: { level: "info", message: "Starting sync (sample run)." },
        }),
      });
      await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          appendLog: { level: "info", message: "Rows processed: (demo — no warehouse credentials logged)." },
        }),
      });
      await fetch(`/api/elt/runs/${run.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: "succeeded",
          appendLog: { level: "info", message: "Completed successfully." },
        }),
      });
      await loadRuns();
      await openDetail(run.id);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Demo failed");
    } finally {
      setDemoBusy(false);
    }
  }

  return (
    <div className="w-full min-w-0 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Runs</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          List and filter executions per pipeline (newest first). Logs are structured and scrubbed — we never store raw
          warehouse credentials. Telemetry is stored here whether ingestion runs on{" "}
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
          <table className="w-full min-w-[640px] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-3 py-2 font-medium">Started</th>
                <th className="px-3 py-2 font-medium">Pipeline</th>
                <th className="px-3 py-2 font-medium">Gateway</th>
                <th className="px-3 py-2 font-medium">Environment</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Telemetry</th>
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

      {(runIdFromUrl || detailLoading) && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4 sm:items-center"
          role="dialog"
          aria-modal
          aria-labelledby="run-detail-title"
          onClick={closeDetail}
        >
          <div
            className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl border border-slate-200 bg-white p-6 shadow-xl dark:border-slate-700 dark:bg-slate-900"
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
