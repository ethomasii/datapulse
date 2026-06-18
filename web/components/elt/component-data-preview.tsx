"use client";

import { useCallback, useEffect, useState } from "react";
import { Eye, Loader2, Zap } from "lucide-react";
import { previewTableFromConfig } from "@/lib/elt/pipeline-asset-keys";

type PreviewResult = {
  ok?: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  truncated?: boolean;
  message?: string;
  error?: string;
  table?: string;
};

type Props = {
  pipelineId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  /** Auto-fetch preview when table or _preview_nonce changes (wire connect). */
  autoLoad?: boolean;
};

export function ComponentDataPreview({
  pipelineId,
  config,
  readOnly = false,
  autoLoad = false,
}: Props) {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [autoTriggered, setAutoTriggered] = useState(false);

  const table = previewTableFromConfig(config);
  const previewNonce = config._preview_nonce;

  const load = useCallback(async () => {
    if (!table) {
      setError("Set output_table or table in config to preview data.");
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ config, limit: 10 }),
      });
      const data = (await res.json()) as PreviewResult & { error?: string };
      if (!res.ok) throw new Error(data.error ?? "Preview failed");
      setResult(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, config, table]);

  useEffect(() => {
    if (!autoLoad || readOnly || !table) return;
    const t = setTimeout(() => {
      setAutoTriggered(true);
      void load();
    }, 400);
    return () => clearTimeout(t);
  }, [autoLoad, readOnly, table, previewNonce, load]);

  if (!table && !readOnly) {
    return (
      <p className="text-xs text-slate-500">
        Wire an upstream step or set a table to enable auto-preview for this step.
      </p>
    );
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-semibold text-slate-700 dark:text-slate-300">
          Data preview
          {autoTriggered && loading ? (
            <span className="ml-1 font-normal text-sky-600 dark:text-sky-400">· auto</span>
          ) : null}
        </p>
        <button
          type="button"
          onClick={() => void load()}
          disabled={loading || readOnly || !table}
          className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] font-medium hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-950"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <Eye className="h-3 w-3" />}
          Sample rows
        </button>
      </div>
      {table ? (
        <p className="mt-1 font-mono text-[10px] text-slate-500">{table}</p>
      ) : null}
      {error ? (
        <p className="mt-2 text-xs text-amber-700 dark:text-amber-300" role="alert">
          {error}
        </p>
      ) : null}
      {result?.rows?.length ? (
        <div className="mt-2 max-h-48 overflow-auto rounded border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
          <table className="w-full text-left text-[10px]">
            <thead className="sticky top-0 bg-slate-100 dark:bg-slate-800">
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
                    <td key={c} className="max-w-[8rem] truncate px-2 py-1 text-slate-700 dark:text-slate-300">
                      {row[c] == null ? "—" : String(row[c])}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : result && !error ? (
        <p className="mt-2 text-xs text-slate-500">{result.message ?? "No rows returned."}</p>
      ) : loading ? (
        <p className="mt-2 flex items-center gap-1 text-xs text-slate-500">
          <Zap className="h-3 w-3" /> Loading preview…
        </p>
      ) : null}
    </div>
  );
}
