"use client";

import type { ColumnLineageRef, ModelColumnLineageMap } from "@/lib/elt/dbt-manifest-lineage";
import { columnLineageForModel } from "@/lib/elt/dbt-manifest-lineage";
import { GitBranch } from "lucide-react";

function formatRef(ref: ColumnLineageRef): string {
  if (ref.model && ref.column) return `${ref.model}.${ref.column}`;
  if (ref.model) return ref.model;
  if (ref.source && ref.column) return `${ref.source}.${ref.column}`;
  if (ref.source) return ref.source;
  return "—";
}

export function AssetColumnLineagePanel({
  modelName,
  columnLineage,
}: {
  modelName: string;
  columnLineage?: ModelColumnLineageMap;
}) {
  const modelCols = columnLineageForModel(columnLineage, modelName);
  if (!modelCols || Object.keys(modelCols).length === 0) return null;

  const rows = Object.entries(modelCols).sort(([a], [b]) => a.localeCompare(b));

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2">
        <GitBranch className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Column lineage</h2>
        <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:bg-violet-900/30 dark:text-violet-300">
          dbt manifest
        </span>
      </div>
      <p className="mt-1 text-sm text-slate-500">
        Upstream columns for this model from the last successful dbt run.
      </p>
      <div className="mt-4 overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-800">
        <table className="min-w-full divide-y divide-slate-200 text-sm dark:divide-slate-800">
          <thead className="bg-slate-50 dark:bg-slate-900/60">
            <tr>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Column
              </th>
              <th className="px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                Derived from
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-950">
            {rows.map(([col, refs]) => (
              <tr key={col}>
                <td className="whitespace-nowrap px-3 py-2 font-mono text-xs text-slate-900 dark:text-white">
                  {col}
                </td>
                <td className="px-3 py-2 font-mono text-xs text-slate-600 dark:text-slate-400">
                  {refs.map((r, i) => (
                    <span key={i}>
                      {i > 0 ? ", " : ""}
                      {formatRef(r)}
                    </span>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
