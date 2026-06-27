"use client";

import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import clsx from "clsx";
import type { CanvasInspectorFocus } from "@/components/pipeline-canvas/pipeline-canvas";
import { readClientFetchJson } from "@/lib/elt/fetch-json-body";
import { inputTableFromConfig, previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";

type PreviewResult = {
  ok?: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  message?: string;
  error?: string;
  table?: string;
};

type PreviewPaneProps = {
  title: string;
  table: string | null;
  pipelineId: string;
  config: Record<string, unknown>;
  className?: string;
  onDiagnosticChange?: (message: string | null) => void;
};

function PreviewPane({ title, table, pipelineId, config, className, onDiagnosticChange }: PreviewPaneProps) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!table) return;
    setLoading(true);
    setError(null);
    onDiagnosticChange?.(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table, config, limit: 8 }),
      });
      const data = await readClientFetchJson<PreviewResult & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      if (data.ok === false) throw new Error(data.message ?? data.error ?? "Preview failed");
      setResult(data);
      onDiagnosticChange?.(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Preview failed";
      setError(msg);
      onDiagnosticChange?.(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, config, table, onDiagnosticChange]);

  const configKey = JSON.stringify(config);

  useEffect(() => {
    if (!table) {
      setResult(null);
      setError(null);
      onDiagnosticChange?.(null);
      return;
    }
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [table, load, configKey, onDiagnosticChange]);

  return (
    <div className={clsx("flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-200 last:border-r-0 dark:border-slate-800", className)}>
      <div className="flex shrink-0 items-center justify-between gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {table ? <p className="truncate font-mono text-[10px] text-slate-400">{table}</p> : null}
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-2">
        {!table ? (
          <p className="text-[11px] text-slate-500">Select a transform step with a wired table.</p>
        ) : loading ? (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : error ? (
          <p className="text-[11px] text-amber-700 dark:text-amber-300">{error}</p>
        ) : result?.rows?.length ? (
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-900">
              <tr>
                {(result.columns ?? Object.keys(result.rows[0] ?? {})).map((c) => (
                  <th key={c} className="px-2 py-1 font-semibold text-slate-600 dark:text-slate-300">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                  {(result.columns ?? Object.keys(row)).map((c) => (
                    <td key={c} className="max-w-[7rem] truncate px-2 py-1 text-slate-700 dark:text-slate-300">
                      {row[c] == null ? "—" : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <p className="text-[11px] text-slate-500">{result?.message ?? "No rows returned."}</p>
        )}
      </div>
    </div>
  );
}

type Props = {
  pipelineId: string;
  focus: CanvasInspectorFocus;
  /** Live config from inspector (may be ahead of focus snapshot). */
  liveConfig?: Record<string, unknown> | null;
  className?: string;
  onInputDiagnosticChange?: (message: string | null) => void;
  onOutputDiagnosticChange?: (message: string | null) => void;
};

/** Lakeflow-style bottom strip — input vs output sample rows for the selected step. */
export function CanvasPreviewPanel({
  pipelineId,
  focus,
  liveConfig,
  className,
  onInputDiagnosticChange,
  onOutputDiagnosticChange,
}: Props) {
  if (focus.kind !== "component") {
    return (
      <section
        className={clsx(
          "flex shrink-0 items-center justify-center border-t border-slate-200 bg-slate-50 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-900/80",
          className ?? "h-44"
        )}
        aria-label="Data preview"
      >
        Select a native transform on the canvas to preview input and output rows.
      </section>
    );
  }

  const config =
    liveConfig ?? ((focus.data.config as Record<string, unknown>) ?? {});
  const inputTable = inputTableFromConfig(config);
  const outputTable = previewTableFromConfig(config);

  return (
    <section
      className={clsx(
        "flex shrink-0 border-t border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
        className ?? "h-44"
      )}
      aria-label="Data preview"
    >
      <PreviewPane
        title="Input data preview"
        table={inputTable}
        pipelineId={pipelineId}
        config={config}
        onDiagnosticChange={onInputDiagnosticChange}
      />
      <PreviewPane
        title="Output data preview"
        table={outputTable}
        pipelineId={pipelineId}
        config={config}
        onDiagnosticChange={onOutputDiagnosticChange}
      />
    </section>
  );
}
