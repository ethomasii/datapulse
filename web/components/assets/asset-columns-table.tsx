"use client";

import type { AssetColumnDef } from "@/lib/elt/catalog-metadata";

const SOURCE_LABELS: Record<string, string> = {
  warehouse: "Warehouse",
  dbt: "Transform",
  dlt: "Ingest",
  sling: "Replicate",
  inferred: "Inferred",
  manual: "Manual",
};

function SourceBadge({ source }: { source?: string }) {
  if (!source) return null;
  return (
    <span className="rounded bg-slate-100 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wide text-slate-500 dark:bg-slate-800 dark:text-slate-400">
      {SOURCE_LABELS[source] ?? source}
    </span>
  );
}

export function AssetColumnsTable({
  columns,
  columnSources,
  warehouseMessage,
  onRefresh,
  refreshing,
}: {
  columns: AssetColumnDef[];
  columnSources?: string[];
  warehouseMessage?: string;
  onRefresh?: () => void;
  refreshing?: boolean;
}) {
  if (!columns.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-200 bg-slate-50/50 px-4 py-6 text-center dark:border-slate-700 dark:bg-slate-900/40">
        <p className="text-sm text-slate-600 dark:text-slate-400">
          No columns known yet. Run the pipeline, then refresh to pull schema from your warehouse (Postgres, BigQuery, or Snowflake).
        </p>
        {warehouseMessage ? (
          <p className="mt-2 text-xs text-slate-500">{warehouseMessage}</p>
        ) : null}
        {onRefresh ? (
          <button
            type="button"
            onClick={onRefresh}
            disabled={refreshing}
            className="mt-3 inline-flex items-center rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 disabled:opacity-50 dark:border-slate-700 dark:text-slate-200"
          >
            {refreshing ? "Loading schema…" : "Load columns from warehouse"}
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {columnSources?.length ? (
        <p className="text-xs text-slate-500">
          Sources: {columnSources.map((s) => SOURCE_LABELS[s] ?? s).join(", ")}
        </p>
      ) : null}
      <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Column
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Type
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Description
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {columns.map((col) => (
              <tr key={col.name}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-900 dark:text-white">
                  {col.name}
                  <span className="ml-2 inline-block align-middle">
                    <SourceBadge source={col.source} />
                  </span>
                </td>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {col.type ?? "—"}
                </td>
                <td className="px-3 py-2 text-xs text-slate-600 dark:text-slate-400">{col.description ?? "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {onRefresh ? (
        <button
          type="button"
          onClick={onRefresh}
          disabled={refreshing}
          className="text-xs font-medium text-sky-600 hover:underline disabled:opacity-50 dark:text-sky-400"
        >
          {refreshing ? "Refreshing…" : "Refresh from warehouse"}
        </button>
      ) : null}
    </div>
  );
}
