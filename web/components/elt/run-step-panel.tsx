"use client";

import { useCallback, useState } from "react";
import { Loader2, Play } from "lucide-react";

type RunStepResult = {
  message?: string;
  needs_full_run?: boolean;
  compiled?: {
    python?: string[];
    sql?: string[];
    tests?: string[];
    warnings?: string[];
  };
  sql_results?: Array<{ sql: string; ok: boolean; message?: string }>;
  preview?: {
    table?: string;
    rows?: Record<string, unknown>[];
    columns?: string[];
    message?: string;
  };
  error?: string;
};

type Props = {
  pipelineId: string;
  nodeId: string;
  componentId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  onPreviewReady?: (preview: RunStepResult["preview"]) => void;
};

/** Per-node run: compile step, run SQL checks, refresh preview (Alteryx "run this tool"). */
export function RunStepPanel({
  pipelineId,
  nodeId,
  componentId,
  config,
  readOnly = false,
  onPreviewReady,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<RunStepResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/run-step`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          component_id: componentId,
          config,
          node_id: nodeId,
        }),
      });
      const data = (await res.json()) as RunStepResult;
      if (!res.ok) throw new Error(data.error ?? "Run step failed");
      setResult(data);
      if (data.preview) onPreviewReady?.(data.preview);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run step failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, nodeId, componentId, config, onPreviewReady]);

  return (
    <div className="rounded-lg border border-violet-200 bg-violet-50/50 p-3 dark:border-violet-900 dark:bg-violet-950/20">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-violet-900 dark:text-violet-200">Run this step</p>
        <button
          type="button"
          onClick={() => void run()}
          disabled={loading || readOnly}
          className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[11px] font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Play className="h-3 w-3" />}
          Run step
        </button>
      </div>
      <p className="mt-1 text-[10px] text-violet-800/80 dark:text-violet-300/80">
        Compiles this tool, runs SQL checks, and samples output rows from the warehouse.
      </p>
      {error ? (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400" role="alert">
          {error}
        </p>
      ) : null}
      {result?.message ? (
        <p className="mt-2 text-xs text-slate-700 dark:text-slate-300">{result.message}</p>
      ) : null}
      {result?.compiled?.warnings?.length ? (
        <ul className="mt-2 list-inside list-disc text-[10px] text-amber-800 dark:text-amber-300">
          {result.compiled.warnings.map((w, i) => (
            <li key={i}>{w}</li>
          ))}
        </ul>
      ) : null}
      {result?.sql_results?.length ? (
        <ul className="mt-2 space-y-1 text-[10px]">
          {result.sql_results.map((s, i) => (
            <li
              key={i}
              className={s.ok ? "text-emerald-700 dark:text-emerald-300" : "text-amber-700 dark:text-amber-300"}
            >
              {s.ok ? "✓" : "○"} {s.sql.slice(0, 80)}
              {s.message ? ` — ${s.message}` : ""}
            </li>
          ))}
        </ul>
      ) : null}
      {result?.needs_full_run ? (
        <p className="mt-2 text-[10px] text-slate-500">
          Python transform code is compiled — save pipeline and run to materialize output tables.
        </p>
      ) : null}
    </div>
  );
}
