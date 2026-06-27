"use client";

import { useEffect, useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { PipelineTableAssetPicker } from "@/components/elt/pipeline-table-asset-picker";
import {
  emptyRouterRouteRow,
  parseRouterRouteRows,
  serializeRouterRoutes,
  type RouterRouteRow,
} from "@/lib/elt/router-routes";

type Props = {
  pipelineId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  onChange: (next: Record<string, unknown>) => void;
};

/** Visual branch editor — syncs to config.routes JSON for the native compiler. */
export function RouterRoutesEditor({ pipelineId, config, readOnly = false, onChange }: Props) {
  const parsed = useMemo(() => parseRouterRouteRows(config), [config]);
  const [rows, setRows] = useState<RouterRouteRow[]>(() =>
    parsed.length ? parsed : [emptyRouterRouteRow()]
  );

  useEffect(() => {
    const next = parseRouterRouteRows(config);
    setRows(next.length ? next : [emptyRouterRouteRow()]);
  }, [config.routes, config.outputs]);

  function commit(nextRows: RouterRouteRow[], defaultOut?: string) {
    onChange({
      ...config,
      routes: serializeRouterRoutes(nextRows),
      ...(defaultOut !== undefined
        ? { default_output_table: defaultOut.trim() || undefined }
        : {}),
    });
  }

  function updateRow(index: number, patch: Partial<RouterRouteRow>) {
    const nextRows = rows.map((row, i) => (i === index ? { ...row, ...patch } : row));
    setRows(nextRows);
    commit(nextRows);
  }

  function addRow() {
    const nextRows = [...rows, emptyRouterRouteRow()];
    setRows(nextRows);
  }

  function removeRow(index: number) {
    const nextRows = rows.filter((_, i) => i !== index);
    const display = nextRows.length ? nextRows : [emptyRouterRouteRow()];
    setRows(display);
    commit(display);
  }

  const defaultOut = String(config.default_output_table ?? config.default_table ?? "").trim();

  return (
    <div className="space-y-3 rounded-lg border border-violet-200 bg-violet-50/40 p-3 dark:border-violet-900/60 dark:bg-violet-950/20">
      <div>
        <p className="text-xs font-semibold text-violet-900 dark:text-violet-100">Routes</p>
        <p className="mt-0.5 text-[10px] text-violet-800/90 dark:text-violet-300/90">
          Each branch writes to its own output table. Connect downstream steps from the matching port on
          the canvas node.
        </p>
      </div>

      <div className="space-y-2">
        {rows.map((row, i) => (
          <div
            key={`route-row-${i}`}
            className="space-y-2 rounded-md border border-violet-200/80 bg-white/80 p-2 dark:border-violet-900/50 dark:bg-slate-950/40"
          >
            <div className="flex items-center justify-between gap-2">
              <p className="text-[10px] font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Branch {i + 1}
              </p>
              {!readOnly && rows.length > 1 ? (
                <button
                  type="button"
                  aria-label={`Remove branch ${i + 1}`}
                  onClick={() => removeRow(i)}
                  className="rounded p-1 text-slate-400 hover:bg-violet-100 hover:text-violet-800 dark:hover:bg-violet-950"
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </button>
              ) : null}
            </div>
            <label className="block text-sm">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">Condition</span>
              <input
                type="text"
                readOnly={readOnly}
                value={row.condition}
                placeholder={'status = "active"'}
                onChange={(e) => updateRow(i, { condition: e.target.value })}
                className="mt-0.5 w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 font-mono text-xs dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
            <label className="block text-sm">
              <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
                Output table *
              </span>
              <PipelineTableAssetPicker
                pipelineId={pipelineId}
                value={row.output_table}
                readOnly={readOnly}
                placeholder="staging.branch_table"
                onChange={(ref) => updateRow(i, { output_table: ref })}
              />
            </label>
          </div>
        ))}
      </div>

      {!readOnly ? (
        <button
          type="button"
          onClick={addRow}
          className="inline-flex items-center gap-1 rounded-md border border-violet-300 px-2 py-1 text-[10px] font-medium text-violet-800 hover:bg-violet-100 dark:border-violet-800 dark:text-violet-200 dark:hover:bg-violet-950/50"
        >
          <Plus className="h-3 w-3" aria-hidden />
          Add branch
        </button>
      ) : null}

      <label className="block text-sm">
        <span className="text-[11px] font-medium text-slate-700 dark:text-slate-300">
          Default output table
        </span>
        <span className="mt-0.5 block text-[10px] text-slate-500">
          Optional — rows that match no branch condition (also gets its own canvas port)
        </span>
        <PipelineTableAssetPicker
          pipelineId={pipelineId}
          value={defaultOut}
          readOnly={readOnly}
          placeholder="staging.unmatched (optional)"
          onChange={(ref) => commit(rows, ref)}
        />
      </label>
    </div>
  );
}
