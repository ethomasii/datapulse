"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, type ComponentType } from "react";
import {
  Activity,
  ArrowRight,
  BarChart3,
  Clock,
  Database,
  Filter,
  HardDrive,
  Loader2,
  RefreshCw,
} from "lucide-react";
import { BarChart } from "@/components/ui/bar-chart";
import type { PipelineMetricsResponse } from "@/lib/elt/pipeline-metrics";
import { formatBytes, formatDurationMs, formatRows } from "@/lib/elt/run-telemetry";
import { ObservabilityAlertRulesPanel } from "@/components/elt/observability-alert-rules";

type ApiResponse = {
  metrics: PipelineMetricsResponse;
  filterOptions: {
    pipelines: { id: string; name: string }[];
    environments: string[];
    tools: string[];
    sourceTypes: string[];
    destinationTypes: string[];
    statuses: string[];
  };
};

function KpiCard({
  label,
  value,
  sub,
  icon: Icon,
}: {
  label: string;
  value: string;
  sub?: string;
  icon: ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500">
        <Icon className="h-4 w-4" aria-hidden />
        <span className="text-xs font-semibold uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
      {sub ? <p className="mt-1 text-xs text-slate-500">{sub}</p> : null}
    </div>
  );
}

export function ObservabilityClient() {
  const searchParams = useSearchParams();
  const [data, setData] = useState<ApiResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [days, setDays] = useState(30);
  const [pipelineId, setPipelineId] = useState(() => searchParams.get("pipeline") ?? "");
  const [environment, setEnvironment] = useState("");
  const [tool, setTool] = useState("");
  const [sourceType, setSourceType] = useState("");
  const [destinationType, setDestinationType] = useState("");
  const [status, setStatus] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const q = new URLSearchParams({ days: String(days) });
      if (pipelineId) q.set("pipelineId", pipelineId);
      if (environment) q.set("environment", environment);
      if (tool) q.set("tool", tool);
      if (sourceType) q.set("sourceType", sourceType);
      if (destinationType) q.set("destinationType", destinationType);
      if (status) q.set("status", status);
      const res = await fetch(`/api/elt/pipelines/metrics?${q.toString()}`);
      if (res.ok) setData((await res.json()) as ApiResponse);
    } finally {
      setLoading(false);
    }
  }, [days, pipelineId, environment, tool, sourceType, destinationType, status]);

  useEffect(() => {
    void load();
  }, [load]);

  const metrics = data?.metrics;
  const opts = data?.filterOptions;

  const chartDays = useMemo(
    () => metrics?.timeSeries.map((b) => b.date.slice(5)) ?? [],
    [metrics?.timeSeries]
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-7xl space-y-8 px-1">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
            <Activity className="h-6 w-6" aria-hidden />
            <span className="text-sm font-semibold uppercase tracking-wide">EL observability</span>
          </div>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Pipeline metrics</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
            Slice ingestion by pipeline, environment, connector, and time. No black box — rows, bytes, duration,
            success rate, and per-table stats from run telemetry and structured log markers.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void load()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-3 py-2 text-sm dark:border-slate-700"
        >
          <RefreshCw className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} aria-hidden />
          Refresh
        </button>
      </div>

      <section className="rounded-xl border border-slate-200 bg-slate-50/50 p-4 dark:border-slate-800 dark:bg-slate-950/30">
        <div className="mb-3 flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Filter className="h-4 w-4" aria-hidden />
          Filters
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-7">
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Window</span>
            <select
              value={days}
              onChange={(e) => setDays(Number(e.target.value))}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={30}>30 days</option>
              <option value={60}>60 days</option>
              <option value={90}>90 days</option>
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Pipeline</span>
            <select
              value={pipelineId}
              onChange={(e) => setPipelineId(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All pipelines</option>
              {(opts?.pipelines ?? []).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Environment</span>
            <select
              value={environment}
              onChange={(e) => setEnvironment(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All</option>
              {(opts?.environments ?? []).map((e) => (
                <option key={e} value={e}>
                  {e}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Tool</span>
            <select
              value={tool}
              onChange={(e) => setTool(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All</option>
              {(opts?.tools ?? []).map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Source</span>
            <select
              value={sourceType}
              onChange={(e) => setSourceType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All</option>
              {(opts?.sourceTypes ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Destination</span>
            <select
              value={destinationType}
              onChange={(e) => setDestinationType(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All</option>
              {(opts?.destinationTypes ?? []).map((d) => (
                <option key={d} value={d}>
                  {d}
                </option>
              ))}
            </select>
          </label>
          <label className="text-xs">
            <span className="font-medium text-slate-600 dark:text-slate-400">Status</span>
            <select
              value={status}
              onChange={(e) => setStatus(e.target.value)}
              className="mt-1 w-full rounded-lg border border-slate-200 px-2 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
            >
              <option value="">All</option>
              {(opts?.statuses ?? []).map((s) => (
                <option key={s} value={s}>
                  {s}
                </option>
              ))}
            </select>
          </label>
        </div>
      </section>

      {loading && !metrics ? (
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading metrics…
        </p>
      ) : metrics ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 xl:grid-cols-6">
            <KpiCard
              label="Runs"
              value={String(metrics.totals.runs)}
              sub={
                metrics.totals.successRate !== null
                  ? `${metrics.totals.successRate}% success · ${metrics.totals.failed} failed`
                  : undefined
              }
              icon={BarChart3}
            />
            <KpiCard
              label="Rows loaded"
              value={formatRows(metrics.totals.rowsLoaded)}
              sub={`Last ${metrics.windowDays} days`}
              icon={Database}
            />
            <KpiCard
              label="Bytes transferred"
              value={formatBytes(metrics.totals.bytesLoaded)}
              icon={HardDrive}
            />
            <KpiCard
              label="Avg duration"
              value={formatDurationMs(metrics.totals.avgDurationMs)}
              sub={
                metrics.totals.p95DurationMs
                  ? `p95 ${formatDurationMs(metrics.totals.p95DurationMs)}`
                  : undefined
              }
              icon={Clock}
            />
            <KpiCard
              label="Pipelines"
              value={String(metrics.byPipeline.length)}
              sub={`${metrics.totals.running} running now`}
              icon={Activity}
            />
            <KpiCard
              label="Median duration"
              value={formatDurationMs(metrics.totals.p50DurationMs)}
              icon={Clock}
            />
          </div>

          {chartDays.length > 0 ? (
            <div className="grid gap-6 lg:grid-cols-2">
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <BarChart
                  days={chartDays}
                  values={metrics.timeSeries.map((b) => b.runs)}
                  label="Runs per day"
                  barClass="fill-sky-500 dark:fill-sky-400"
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <BarChart
                  days={chartDays}
                  values={metrics.timeSeries.map((b) => b.rowsLoaded)}
                  label="Rows loaded per day"
                  barClass="fill-emerald-500 dark:fill-emerald-400"
                  formatter={formatRows}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <BarChart
                  days={chartDays}
                  values={metrics.timeSeries.map((b) => b.bytesLoaded)}
                  label="Bytes per day"
                  barClass="fill-violet-500 dark:fill-violet-400"
                  formatter={formatBytes}
                />
              </div>
              <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
                <BarChart
                  days={chartDays}
                  values={metrics.timeSeries.map((b) => b.avgDurationMs ?? 0)}
                  label="Avg run duration (ms)"
                  barClass="fill-amber-500 dark:fill-amber-400"
                  formatter={(n) => formatDurationMs(n)}
                />
              </div>
            </div>
          ) : null}

          <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
            <h2 className="border-b border-slate-100 px-4 py-3 text-sm font-semibold dark:border-slate-800">
              By pipeline
            </h2>
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead>
                  <tr className="text-left text-xs uppercase text-slate-500">
                    <th className="px-4 py-2">Pipeline</th>
                    <th className="px-4 py-2">Tool</th>
                    <th className="px-4 py-2">Source → Dest</th>
                    <th className="px-4 py-2">Runs</th>
                    <th className="px-4 py-2">Success</th>
                    <th className="px-4 py-2">Rows</th>
                    <th className="px-4 py-2">Bytes</th>
                    <th className="px-4 py-2">Avg duration</th>
                    <th className="px-4 py-2">Last run</th>
                    <th className="px-4 py-2" />
                  </tr>
                </thead>
                <tbody>
                  {metrics.byPipeline.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="px-4 py-8 text-center text-slate-500">
                        No runs in this window — adjust filters or trigger a pipeline run.
                      </td>
                    </tr>
                  ) : (
                    metrics.byPipeline.map((p) => (
                      <tr key={p.pipelineId} className="border-t border-slate-100 dark:border-slate-800">
                        <td className="px-4 py-2 font-medium text-slate-900 dark:text-white">{p.pipelineName}</td>
                        <td className="px-4 py-2 text-slate-600 dark:text-slate-400">{p.tool}</td>
                        <td className="px-4 py-2 text-xs text-slate-500">
                          {p.sourceType} → {p.destinationType}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{p.runs}</td>
                        <td className="px-4 py-2 font-mono text-xs">
                          {p.successRate !== null ? `${p.successRate}%` : "—"}
                        </td>
                        <td className="px-4 py-2 font-mono text-xs">{formatRows(p.rowsLoaded)}</td>
                        <td className="px-4 py-2 font-mono text-xs">{formatBytes(p.bytesLoaded)}</td>
                        <td className="px-4 py-2 font-mono text-xs">{formatDurationMs(p.avgDurationMs)}</td>
                        <td className="px-4 py-2 text-xs capitalize text-slate-500">
                          {p.lastRunStatus ?? "—"}
                        </td>
                        <td className="px-4 py-2">
                          <Link
                            href={`/runs?pipeline=${encodeURIComponent(p.pipelineId)}`}
                            className="inline-flex items-center gap-1 text-sky-600 hover:underline dark:text-sky-400"
                          >
                            Runs <ArrowRight className="h-3 w-3" />
                          </Link>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-4 lg:grid-cols-2 xl:grid-cols-4">
            {(
              [
                ["By environment", metrics.byEnvironment],
                ["By tool", metrics.byTool],
                ["By source", metrics.bySourceType],
                ["By trigger", metrics.byTrigger],
              ] as const
            ).map(([title, rows]) => (
              <section
                key={title}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <h3 className="text-sm font-semibold text-slate-900 dark:text-white">{title}</h3>
                <ul className="mt-3 space-y-2">
                  {rows.slice(0, 6).map((r) => (
                    <li key={r.key} className="flex items-center justify-between gap-2 text-xs">
                      <span className="truncate text-slate-700 dark:text-slate-300">{r.label}</span>
                      <span className="shrink-0 font-mono text-slate-500">
                        {r.runs} · {formatRows(r.rowsLoaded)} rows
                      </span>
                    </li>
                  ))}
                  {rows.length === 0 ? (
                    <li className="text-xs text-slate-500">No data</li>
                  ) : null}
                </ul>
              </section>
            ))}
          </div>
        </>
      ) : null}

      <ObservabilityAlertRulesPanel />
    </div>
  );
}
