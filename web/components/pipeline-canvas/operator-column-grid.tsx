"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import clsx from "clsx";

import { operatorColumnGridMode } from "@/lib/elt/operator-column-grid-mode";
import { readClientFetchJson } from "@/lib/elt/fetch-json-body";
import { formatMotherduckColumnErrorForTableRef } from "@/lib/elt/warehouse-column-errors";

type ColumnMeta = { name: string; type?: string };

type Props = {
  pipelineId: string;
  inputTable: string | null;
  componentId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  onChange: (next: Record<string, unknown>) => void;
  onDiagnosticChange?: (message: string | null) => void;
};

function parseMapping(raw: unknown): Record<string, string> {
  if (typeof raw === "string") {
    try {
      return Object.fromEntries(
        Object.entries(JSON.parse(raw) as Record<string, unknown>).map(([k, v]) => [k, String(v)])
      );
    } catch {
      return {};
    }
  }
  if (raw && typeof raw === "object") {
    return Object.fromEntries(
      Object.entries(raw as Record<string, unknown>).map(([k, v]) => [k, String(v)])
    );
  }
  return {};
}

function selectedColumns(config: Record<string, unknown>): string[] {
  const raw = config.columns ?? config.column_names;
  if (Array.isArray(raw)) return raw.map(String).filter(Boolean);
  if (typeof raw === "string") return raw.split(",").map((s) => s.trim()).filter(Boolean);
  return [];
}

function friendlyColumnLoadError(
  message: string,
  tableRef: string,
  configuredDatabase?: string
): string {
  const trimmed = message.trim();
  if (/^not found$/i.test(trimmed)) {
    return formatMotherduckColumnErrorForTableRef(
      tableRef,
      configuredDatabase ?? "your connection catalog",
      trimmed
    );
  }
  return message;
}

/** Lakeflow-style column picker — checkboxes + rename inputs wired to native step config. */
export function OperatorColumnGrid({
  pipelineId,
  inputTable,
  componentId,
  config,
  readOnly = false,
  onChange,
  onDiagnosticChange,
}: Props) {
  const [columns, setColumns] = useState<ColumnMeta[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const onDiagnosticChangeRef = useRef(onDiagnosticChange);
  onDiagnosticChangeRef.current = onDiagnosticChange;

  const mode = useMemo(() => operatorColumnGridMode(componentId), [componentId]);

  const loadColumns = useCallback(async () => {
    const tableRef = inputTable?.trim() || null;
    if (!tableRef) {
      setColumns([]);
      setError(null);
      onDiagnosticChangeRef.current?.(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${encodeURIComponent(pipelineId)}/preview`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ table: tableRef, columnsOnly: true }),
      });
      const data = await readClientFetchJson<{
        ok?: boolean;
        message?: string;
        columns?: string[];
        rows?: Record<string, unknown>[];
        error?: string;
        table?: string;
        configuredDatabase?: string;
      }>(res);
      if (!res.ok) {
        throw new Error(data.error ?? data.message ?? "Could not load columns");
      }
      const names =
        data.columns?.length
          ? data.columns
          : data.rows?.[0]
            ? Object.keys(data.rows[0])
            : [];
      if (!names.length) {
        const msg = friendlyColumnLoadError(
          data.message ??
            `No columns found for ${data.table ?? tableRef}. Run a sync and confirm your MotherDuck connection Database (e.g. my_db) matches where dlt wrote data.`,
          data.table ?? tableRef,
          data.configuredDatabase
        );
        setColumns([]);
        setError(msg);
        onDiagnosticChangeRef.current?.(msg);
        return;
      }
      setColumns(names.map((name) => ({ name })));
      onDiagnosticChangeRef.current?.(null);
    } catch (e) {
      const raw = e instanceof Error ? e.message : "Column load failed";
      const msg = friendlyColumnLoadError(raw, tableRef);
      setError(msg);
      onDiagnosticChangeRef.current?.(msg);
      setColumns([]);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, inputTable]);

  useEffect(() => {
    const t = setTimeout(() => void loadColumns(), 250);
    return () => clearTimeout(t);
  }, [loadColumns]);

  if (!mode) return null;

  const picked = selectedColumns(config);
  const mapping = parseMapping(config.mapping ?? config.column_mapping ?? config.rename_map);
  const pickedSet = new Set(mode === "select" ? picked : Object.keys(mapping));

  function toggleColumn(name: string, on: boolean) {
    if (mode === "select") {
      const next = on
        ? [...picked.filter((c) => c !== name), name]
        : picked.filter((c) => c !== name);
      onChange({ ...config, columns: next });
      return;
    }
    const nextMap = { ...mapping };
    if (on) {
      if (!nextMap[name]) nextMap[name] = name;
    } else {
      delete nextMap[name];
    }
    onChange({ ...config, mapping: nextMap });
  }

  function setRename(source: string, target: string) {
    const nextMap = { ...mapping, [source]: target.trim() || source };
    onChange({ ...config, mapping: nextMap });
  }

  function addCustomColumn() {
    const name = window.prompt("New column name (expression alias):");
    if (!name?.trim()) return;
    if (mode === "select") {
      onChange({ ...config, columns: [...picked, name.trim()] });
    } else {
      onChange({ ...config, mapping: { ...mapping, [name.trim()]: name.trim() } });
    }
  }

  return (
    <div className="rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-950">
      <div className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2 dark:border-slate-700">
        <div>
          <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Columns</p>
          <p className="text-[10px] text-slate-500">
            {mode === "select" ? "Include columns in the projection" : "Rename included columns"}
          </p>
        </div>
        {!readOnly ? (
          <button
            type="button"
            onClick={addCustomColumn}
            className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-900"
          >
            <Plus className="h-3 w-3" aria-hidden />
            Add custom
          </button>
        ) : null}
      </div>

      <div className="max-h-56 min-h-[4.5rem] overflow-y-auto overscroll-contain">
        {!inputTable ? (
          <p className="px-3 py-4 text-[11px] text-slate-500">Wire an input table to load columns.</p>
        ) : loading ? (
          <p className="flex items-center gap-1 px-3 py-4 text-[11px] text-slate-500">
            <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
            Loading columns…
          </p>
        ) : error ? (
          <p className="px-3 py-4 text-[11px] text-amber-700 dark:text-amber-300">
            Couldn&apos;t load columns. Expand <strong>Step diagnostics</strong> above for details.
          </p>
        ) : columns.length === 0 ? (
          <p className="px-3 py-4 text-[11px] text-slate-500">
            No columns yet for {inputTable}. Run a sync or check Step diagnostics above.
          </p>
        ) : (
          <table className="w-full text-left text-[11px]">
            <thead className="sticky top-0 bg-slate-50 dark:bg-slate-900">
              <tr>
                <th className="w-8 px-2 py-1.5 font-semibold text-slate-500"> </th>
                <th className="px-2 py-1.5 font-semibold text-slate-500">Column</th>
                {mode === "rename" ? (
                  <th className="px-2 py-1.5 font-semibold text-slate-500">Rename</th>
                ) : null}
              </tr>
            </thead>
            <tbody>
              {columns.map((col) => {
                const checked = pickedSet.has(col.name);
                return (
                  <tr
                    key={col.name}
                    className={clsx(
                      "border-t border-slate-100 dark:border-slate-800",
                      checked && "bg-sky-50/60 dark:bg-sky-950/20"
                    )}
                  >
                    <td className="px-2 py-1">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={readOnly}
                        onChange={(e) => toggleColumn(col.name, e.target.checked)}
                        aria-label={`Include ${col.name}`}
                      />
                    </td>
                    <td className="px-2 py-1 font-mono text-slate-800 dark:text-slate-200">{col.name}</td>
                    {mode === "rename" ? (
                      <td className="px-2 py-1">
                        <input
                          type="text"
                          disabled={readOnly || !checked}
                          value={mapping[col.name] ?? col.name}
                          onChange={(e) => setRename(col.name, e.target.value)}
                          className="w-full rounded border border-slate-200 bg-white px-1.5 py-0.5 font-mono text-[10px] dark:border-slate-600 dark:bg-slate-900"
                          placeholder={col.name}
                        />
                      </td>
                    ) : null}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}
