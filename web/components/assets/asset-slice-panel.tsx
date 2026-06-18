"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { Calendar, CheckCircle2, Loader2, Play, RefreshCw, XCircle } from "lucide-react";
import type { PartitionConfig } from "@/components/elt/partition-config-editor";

type SliceRow = {
  column: string;
  value: string;
  status: string;
  runId: string;
  startedAt: string;
};

type SliceResponse = {
  pipelineId: string;
  pipelineName: string;
  partitionConfig: PartitionConfig | null;
  slices: SliceRow[];
};

function SliceStatus({ status }: { status: string }) {
  if (status === "succeeded") {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400">
        <CheckCircle2 className="h-3.5 w-3.5" /> OK
      </span>
    );
  }
  if (status === "failed" || status === "cancelled") {
    return (
      <span className="inline-flex items-center gap-1 text-red-600 dark:text-red-400">
        <XCircle className="h-3.5 w-3.5" /> {status}
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 text-sky-600 dark:text-sky-400">
      <Loader2 className="h-3.5 w-3.5 animate-spin" /> {status}
    </span>
  );
}

export function AssetSlicePanel({ assetKey, pipelineId }: { assetKey: string; pipelineId: string }) {
  const [data, setData] = useState<SliceResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [launching, setLaunching] = useState<string | null>(null);
  const [manualValue, setManualValue] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/elt/assets/history?assetKey=${encodeURIComponent(assetKey)}&days=90`);
      if (res.ok) {
        const body = (await res.json()) as SliceResponse;
        setData(body);
      }
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    void load();
  }, [load]);

  const partition = data?.partitionConfig;
  const column = partition?.type !== "none" ? partition?.column?.trim() : "";
  const hasSlices = partition?.type === "date" || partition?.type === "key";

  async function queueSlice(value: string) {
    if (!column || !value.trim()) return;
    const key = `${column}::${value.trim()}`;
    setLaunching(key);
    setError(null);
    try {
      const res = await fetch("/api/elt/runs", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          pipelineId,
          environment: "backfill",
          triggeredBy: `backfill:partition:${column}:${value.trim()}`,
          partitionColumn: column,
          partitionValue: value.trim(),
          status: "pending",
        }),
      });
      if (!res.ok) {
        const d = (await res.json().catch(() => ({}))) as { error?: unknown };
        throw new Error(typeof d.error === "string" ? d.error : "Launch failed");
      }
      setManualValue("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Launch failed");
    } finally {
      setLaunching(null);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading slices…
      </p>
    );
  }

  if (!hasSlices || !column) {
    return (
      <section className="rounded-xl border border-dashed border-slate-200 px-4 py-5 dark:border-slate-700">
        <div className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-300">
          <Calendar className="h-4 w-4 text-teal-600" aria-hidden />
          Run slices
        </div>
        <p className="mt-2 text-xs text-slate-500">
          No partition column configured for this pipeline. Add date or key slicing in{" "}
          <Link href={`/builder?pipeline=${pipelineId}`} className="text-sky-600 hover:underline dark:text-sky-400">
            Builder
          </Link>{" "}
          or{" "}
          <Link href={`/run-slices?pipeline=${pipelineId}`} className="text-sky-600 hover:underline dark:text-sky-400">
            Run slices
          </Link>
          .
        </p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400">
            <Calendar className="h-4 w-4" aria-hidden />
            <span className="text-xs font-semibold uppercase tracking-wide">Run slices</span>
          </div>
          <h2 className="mt-1 text-sm font-semibold text-slate-900 dark:text-white">
            {partition?.type === "date" ? "Date slices" : "Key slices"} · <code className="font-mono text-xs">{column}</code>
          </h2>
          <p className="mt-1 text-xs text-slate-500">
            Slices are pipeline-scoped — each backfill run loads data for one partition value into assets in this pipeline.
          </p>
        </div>
        <Link
          href={`/run-slices?pipeline=${encodeURIComponent(pipelineId)}`}
          className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          Full coverage →
        </Link>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        <input
          type="text"
          value={manualValue}
          onChange={(e) => setManualValue(e.target.value)}
          placeholder={partition?.type === "date" ? "2024-01-15" : "slice value"}
          className="min-w-0 flex-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm dark:border-slate-700 dark:bg-slate-950"
        />
        <button
          type="button"
          disabled={!manualValue.trim() || launching !== null}
          onClick={() => void queueSlice(manualValue)}
          className="inline-flex items-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-teal-700 disabled:opacity-50"
        >
          {launching ? <Loader2 className="h-4 w-4 animate-spin" /> : <Play className="h-4 w-4" />}
          Run slice
        </button>
        <button type="button" onClick={() => void load()} className="rounded-lg border border-slate-200 p-1.5 dark:border-slate-700">
          <RefreshCw className="h-4 w-4 text-slate-500" aria-hidden />
        </button>
      </div>
      {error ? <p className="mt-2 text-xs text-red-600">{error}</p> : null}

      <ul className="mt-4 max-h-48 divide-y divide-slate-100 overflow-y-auto dark:divide-slate-800">
        {(data?.slices ?? []).length === 0 ? (
          <li className="py-4 text-center text-xs text-slate-500">No slice backfills yet — run one above.</li>
        ) : (
          data!.slices.slice(0, 20).map((s) => (
            <li key={`${s.column}::${s.value}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-xs">
              <span className="font-mono text-slate-800 dark:text-slate-200">{s.value}</span>
              <div className="flex items-center gap-2">
                <SliceStatus status={s.status} />
                <span className="text-slate-400">{new Date(s.startedAt).toLocaleDateString()}</span>
                <button
                  type="button"
                  disabled={launching === `${s.column}::${s.value}`}
                  onClick={() => void queueSlice(s.value)}
                  className="text-teal-600 hover:underline disabled:opacity-50 dark:text-teal-400"
                >
                  Re-run
                </button>
                <Link href={`/runs?run=${s.runId}`} className="text-sky-600 hover:underline dark:text-sky-400">
                  Run
                </Link>
              </div>
            </li>
          ))
        )}
      </ul>
    </section>
  );
}
