"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ChevronDown, ChevronUp, Eye, EyeOff, Loader2, RefreshCw, Search } from "lucide-react";
import clsx from "clsx";
import { ColumnProfileBar } from "@/components/pipeline-canvas/column-profile-bar";
import { readClientFetchJson } from "@/lib/elt/fetch-json-body";
import type { InputPreviewSource } from "@/lib/elt/pipeline-asset-keys";
import {
  enrichProfilesFromSampleRows,
  type ColumnProfile,
} from "@/lib/elt/warehouse-column-profile";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import {
  filterPreviewRows,
  sortPreviewRows,
  type SortDirection,
} from "@/lib/elt/preview-row-utils";

const PREVIEW_ROW_LIMIT = 25;

function pickActivePreviewTable(
  table: string | null,
  sources: InputPreviewSource[] | undefined,
  activeSourceId: string
): string | null {
  if (!sources?.length) return table;
  if (sources.length === 1) return sources[0]!.table;
  return sources.find((s) => s.id === activeSourceId)?.table ?? sources[0]?.table ?? table;
}

type PreviewResult = {
  ok?: boolean;
  columns?: string[];
  rows?: Record<string, unknown>[];
  rowCount?: number;
  message?: string;
  error?: string;
  table?: string;
  columnProfiles?: Record<string, ColumnProfile>;
  fusedPreview?: boolean;
  fusedSteps?: number;
};

type Props = {
  title: string;
  table: string | null;
  pipelineId: string;
  config: Record<string, unknown>;
  className?: string;
  onDiagnosticChange?: (message: string | null) => void;
  /** Join steps: switch between left/right (or other) wired inputs. */
  inputSources?: InputPreviewSource[];
  /** Router steps: switch between branch output tables. */
  outputSources?: InputPreviewSource[];
  /** Fused SELECT preview for warehouse steps (output pane). */
  fusedPreview?: boolean;
  throughStepId?: string | null;
  eltComponents?: PipelineComponentSpec[];
  deployment?: string;
  /** Shown when no table is wired for preview (e.g. router without routes). */
  emptyHint?: string | null;
};

export function DataPreviewPane({
  title,
  table,
  pipelineId,
  config,
  className,
  onDiagnosticChange,
  inputSources,
  outputSources,
  fusedPreview = false,
  throughStepId = null,
  eltComponents,
  deployment,
  emptyHint = null,
}: Props) {
  const switchableSources =
    inputSources && inputSources.length > 0
      ? inputSources
      : outputSources && outputSources.length > 0
        ? outputSources
        : undefined;
  const sourcePickerLabel = outputSources?.length ? "Select output branch" : "Select input table";

  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<PreviewResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [showProfile, setShowProfile] = useState(true);
  const [search, setSearch] = useState("");
  const [sortColumn, setSortColumn] = useState<string | null>(null);
  const [sortDirection, setSortDirection] = useState<SortDirection>("asc");
  const [activeSourceId, setActiveSourceId] = useState(
    switchableSources?.[0]?.id ?? "input"
  );
  const onDiagnosticChangeRef = useRef(onDiagnosticChange);
  onDiagnosticChangeRef.current = onDiagnosticChange;

  const activeTable = pickActivePreviewTable(table, switchableSources, activeSourceId);

  useEffect(() => {
    if (switchableSources?.length && !switchableSources.some((s) => s.id === activeSourceId)) {
      setActiveSourceId(switchableSources[0]!.id);
    }
  }, [switchableSources, activeSourceId]);

  const load = useCallback(async () => {
    const useFused =
      fusedPreview &&
      throughStepId &&
      eltComponents?.length &&
      !inputSources?.length &&
      !outputSources?.length;
    if (!useFused && !activeTable) return;
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          table: activeTable?.trim() || undefined,
          config,
          limit: PREVIEW_ROW_LIMIT,
          includeProfiles: !useFused,
          fusedPreview: useFused,
          throughStepId: useFused ? throughStepId : undefined,
          elt_components: useFused ? eltComponents : undefined,
          deployment,
        }),
      });
      const data = await readClientFetchJson<PreviewResult & { error?: string }>(res);
      if (!res.ok) throw new Error(data.error ?? data.message ?? "Preview failed");
      if (data.ok === false) throw new Error(data.message ?? data.error ?? "Preview failed");
      setResult(data);
      onDiagnosticChangeRef.current?.(null);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Preview failed";
      setError(msg);
      onDiagnosticChangeRef.current?.(msg);
      setResult(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, config, activeTable, fusedPreview, throughStepId, eltComponents, inputSources, outputSources, deployment]);

  const configKey = JSON.stringify(config);
  const componentsKey = JSON.stringify(eltComponents ?? []);
  const sourcesKey = JSON.stringify(switchableSources ?? []);

  useEffect(() => {
    const useFused =
      fusedPreview &&
      throughStepId &&
      eltComponents?.length &&
      !inputSources?.length &&
      !outputSources?.length;
    if (!useFused && !activeTable) {
      setResult(null);
      setError(null);
      onDiagnosticChangeRef.current?.(null);
      return;
    }
    const t = setTimeout(() => void load(), 350);
    return () => clearTimeout(t);
  }, [activeTable, load, configKey, componentsKey, sourcesKey, fusedPreview, throughStepId, inputSources, outputSources, deployment]);

  const rows = result?.rows ?? [];
  const columnNames = useMemo(
    () => (result?.columns?.length ? result.columns : rows[0] ? Object.keys(rows[0]) : []),
    [result?.columns, rows]
  );

  const profiles = useMemo(
    () => enrichProfilesFromSampleRows(result?.columnProfiles ?? {}, columnNames, rows),
    [result?.columnProfiles, columnNames, rows]
  );

  const displayRows = useMemo(() => {
    let next = filterPreviewRows(rows, search);
    if (sortColumn) next = sortPreviewRows(next, sortColumn, sortDirection);
    return next;
  }, [rows, search, sortColumn, sortDirection]);

  function toggleSort(column: string) {
    if (sortColumn !== column) {
      setSortColumn(column);
      setSortDirection("asc");
      return;
    }
    if (sortDirection === "asc") {
      setSortDirection("desc");
      return;
    }
    setSortColumn(null);
  }

  function renderTable() {
    if (!columnNames.length) return null;

    return (
      <table className="w-full text-left text-[10px]">
        <thead className="sticky top-0 z-[1] bg-slate-100 dark:bg-slate-900">
          <tr>
            {columnNames.map((c) => {
              const active = sortColumn === c;
              return (
                <th key={c} className="min-w-[5.5rem] px-2 py-1 align-bottom">
                  <button
                    type="button"
                    onClick={() => toggleSort(c)}
                    className="group flex w-full items-center gap-0.5 text-left font-semibold text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    title="Sort column"
                  >
                    <span className="truncate">{c}</span>
                    {active ? (
                      sortDirection === "asc" ? (
                        <ChevronUp className="h-3 w-3 shrink-0" aria-hidden />
                      ) : (
                        <ChevronDown className="h-3 w-3 shrink-0" aria-hidden />
                      )
                    ) : (
                      <span className="h-3 w-3 shrink-0 opacity-0 group-hover:opacity-40" aria-hidden>
                        ↕
                      </span>
                    )}
                  </button>
                </th>
              );
            })}
          </tr>
          {showProfile ? (
            <tr className="border-t border-slate-200/80 dark:border-slate-700/80">
              {columnNames.map((c) => (
                <th key={`${c}-profile`} className="min-w-[5.5rem] px-2 pb-1.5 align-top font-normal">
                  <ColumnProfileBar profile={profiles[c]} sampleValues={rows.map((r) => r[c])} />
                </th>
              ))}
            </tr>
          ) : null}
        </thead>
        {displayRows.length ? (
          <tbody>
            {displayRows.map((row, i) => (
              <tr key={i} className="border-t border-slate-100 dark:border-slate-800">
                {columnNames.map((c) => (
                  <td key={c} className="max-w-[8rem] truncate px-2 py-1 text-slate-700 dark:text-slate-300">
                    {row[c] == null ? "—" : String(row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        ) : (
          <tbody>
            <tr>
              <td colSpan={columnNames.length} className="px-2 py-3 text-slate-500">
                {search.trim() ? "No rows match your search." : "No rows returned."}
              </td>
            </tr>
          </tbody>
        )}
      </table>
    );
  }

  const sourceLabel =
    switchableSources && switchableSources.length > 1
      ? switchableSources.find((s) => s.id === activeSourceId)?.label
      : null;

  return (
    <div
      className={clsx(
        "flex min-h-0 min-w-0 flex-1 flex-col border-r border-slate-200 last:border-r-0 dark:border-slate-800",
        className
      )}
    >
      <div className="flex shrink-0 flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-1.5 dark:border-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{title}</p>
        {switchableSources && switchableSources.length > 1 ? (
          <select
            value={activeSourceId}
            onChange={(e) => setActiveSourceId(e.target.value)}
            className="max-w-[11rem] truncate rounded border border-slate-200 bg-white px-1.5 py-0.5 text-[10px] text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
            aria-label={sourcePickerLabel}
            title={sourceLabel ?? undefined}
          >
            {switchableSources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.label}
              </option>
            ))}
          </select>
        ) : null}
        {result?.fusedPreview ? (
          <span
            className="rounded bg-violet-100 px-1.5 py-0.5 text-[9px] font-semibold text-violet-800 dark:bg-violet-950/50 dark:text-violet-200"
            title={
              result.fusedSteps && result.fusedSteps > 1
                ? `Fused ${result.fusedSteps} SQL steps — no intermediate table`
                : "Fused SQL preview"
            }
          >
            Fused preview
          </span>
        ) : null}
        <div className="ml-auto flex flex-wrap items-center gap-1.5">
          {activeTable ? (
            <>
              <label className="relative flex items-center">
                <Search className="pointer-events-none absolute left-1.5 h-3 w-3 text-slate-400" aria-hidden />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search rows…"
                  className="w-[7.5rem] rounded border border-slate-200 bg-white py-0.5 pl-6 pr-1.5 text-[10px] dark:border-slate-700 dark:bg-slate-900 sm:w-[9rem]"
                />
              </label>
              <button
                type="button"
                onClick={() => setShowProfile((v) => !v)}
                className="inline-flex items-center gap-1 rounded border border-slate-200 px-1.5 py-0.5 text-[10px] text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                title={showProfile ? "Hide column profiles" : "Show column profiles"}
              >
                {showProfile ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                Profile
              </button>
              <button
                type="button"
                onClick={() => void load()}
                disabled={loading}
                className="inline-flex items-center rounded border border-slate-200 p-0.5 text-slate-600 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-700 dark:text-slate-300 dark:hover:bg-slate-900"
                title="Refresh preview"
              >
                <RefreshCw className={clsx("h-3 w-3", loading && "animate-spin")} aria-hidden />
              </button>
            </>
          ) : null}
        </div>
      </div>
      <div className="min-h-[3.5rem] flex-1 overflow-auto p-2">
        {!activeTable ? (
          <p className="text-[11px] text-slate-500">
            {emptyHint ?? "Select a transform step with a wired table."}
          </p>
        ) : loading && !result ? (
          <p className="flex items-center gap-1 text-[11px] text-slate-500">
            <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            Loading…
          </p>
        ) : error ? (
          <p className="line-clamp-3 text-[11px] text-amber-700 dark:text-amber-300" title={error}>
            {error}
          </p>
        ) : result && (rows.length || columnNames.length) ? (
          <>
            {renderTable()}
            <p className="mt-1 text-[9px] text-slate-400">
              {displayRows.length} of {rows.length} row{rows.length === 1 ? "" : "s"} shown
              {result.rowCount != null && result.rowCount > rows.length ? ` (${result.rowCount} in table)` : ""}
            </p>
          </>
        ) : (
          <p className="text-[11px] text-slate-500">{result?.message ?? "No rows returned."}</p>
        )}
      </div>
    </div>
  );
}
