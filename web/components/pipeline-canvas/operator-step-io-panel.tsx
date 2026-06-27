"use client";

import { Plus, Trash2 } from "lucide-react";
import { applyPickedAssetToConfig } from "@/lib/elt/catalog-asset-link";
import { PipelineTableAssetPicker } from "@/components/elt/pipeline-table-asset-picker";
import type { StepIoMode } from "@/lib/elt/canvas-inspector-layout";
import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";

type AssetPick = Pick<WorkspaceAsset, "id" | "landingQualified" | "displayName" | "name">;

type Props = {
  pipelineId: string;
  mode: StepIoMode;
  config: Record<string, unknown>;
  readOnly?: boolean;
  outputOptional?: boolean;
  onChange: (next: Record<string, unknown>) => void;
};

function tableList(raw: unknown): string[] {
  if (Array.isArray(raw)) return raw.map(String).map((s) => s.trim()).filter(Boolean);
  if (typeof raw === "string") {
    return raw
      .split(",")
      .map((s) => s.trim())
      .filter(Boolean);
  }
  return [];
}

/** Unified table I/O — single, join, union, or output-only (AI / MCP). */
export function OperatorStepIoPanel({
  pipelineId,
  mode,
  config,
  readOnly = false,
  outputOptional = true,
  onChange,
}: Props) {
  const inputRef = String(config.table ?? config.input_table ?? "").trim();
  const leftRef = String(config.left_table ?? config.left_asset_key ?? "").trim();
  const rightRef = String(config.right_table ?? config.right_asset_key ?? "").trim();
  const outputRef = String(config.output_table ?? "").trim();
  const unionTables = tableList(config.tables ?? config.input_tables);

  function patchTable(key: string, tableRef: string, asset?: AssetPick, extra?: Record<string, unknown>) {
    let next = applyPickedAssetToConfig(config, key, tableRef, asset);
    if (key === "table") next = { ...next, input_table: tableRef };
    if (extra) next = { ...next, ...extra };
    onChange(next);
  }

  const title =
    mode === "join"
      ? "Join inputs"
      : mode === "union"
        ? "Union inputs"
        : mode === "router"
          ? "Router inputs"
        : mode === "output_only"
          ? "Output"
          : "Tables";

  const subtitle =
    mode === "join"
      ? "Wire two upstream nodes or pick left and right tables, then set where the join lands."
      : mode === "union"
        ? "Pick two or more tables to stack, then set the combined output table."
        : mode === "router"
          ? "Reads one input table and writes multiple output tables — one per route condition below."
        : mode === "output_only"
          ? "Optional landing table for this step's results."
          : "Wire an upstream node to auto-fill the input table, or pick from this pipeline.";

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">{title}</p>
        <p className="mt-0.5 text-[10px] text-slate-500">{subtitle}</p>
      </div>

      {mode === "single" || mode === "router" ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Input table *</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Table this step reads from — wire from <strong>Destination</strong> (landed warehouse data), not Source
          </span>
          <PipelineTableAssetPicker
            pipelineId={pipelineId}
            value={inputRef}
            readOnly={readOnly}
            placeholder="schema.table"
            onChange={(ref, asset) => patchTable("table", ref, asset)}
          />
        </label>
      ) : null}

      {mode === "join" ? (
        <>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Left table *</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">Primary / driving table</span>
            <PipelineTableAssetPicker
              pipelineId={pipelineId}
              value={leftRef}
              readOnly={readOnly}
              placeholder="schema.table"
              onChange={(ref, asset) => patchTable("left_table", ref, asset)}
            />
          </label>
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Right table *</span>
            <span className="mt-0.5 block text-[11px] text-slate-500">Table to join in</span>
            <PipelineTableAssetPicker
              pipelineId={pipelineId}
              value={rightRef}
              readOnly={readOnly}
              placeholder="schema.table"
              onChange={(ref, asset) => patchTable("right_table", ref, asset)}
            />
          </label>
        </>
      ) : null}

      {mode === "union" ? (
        <div className="space-y-2">
          <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Source tables *</p>
          {unionTables.length === 0 ? (
            <p className="text-[11px] text-slate-500">Add at least two tables to union.</p>
          ) : (
            unionTables.map((t, i) => (
              <div key={`${i}-${t}`} className="flex items-start gap-1">
                <div className="min-w-0 flex-1">
                  <PipelineTableAssetPicker
                    pipelineId={pipelineId}
                    value={t}
                    readOnly={readOnly}
                    placeholder="schema.table"
                    onChange={(ref) => {
                      const next = [...unionTables];
                      next[i] = ref;
                      onChange({ ...config, tables: next });
                    }}
                  />
                </div>
                {!readOnly ? (
                  <button
                    type="button"
                    aria-label="Remove table"
                    onClick={() => {
                      const next = unionTables.filter((_, j) => j !== i);
                      onChange({ ...config, tables: next });
                    }}
                    className="mt-1 rounded p-1 text-slate-400 hover:bg-slate-200 hover:text-slate-700 dark:hover:bg-slate-800"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                ) : null}
              </div>
            ))
          )}
          {!readOnly ? (
            <button
              type="button"
              onClick={() => onChange({ ...config, tables: [...unionTables, ""] })}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 px-2 py-1 text-[10px] font-medium hover:bg-white dark:border-slate-600 dark:hover:bg-slate-900"
            >
              <Plus className="h-3 w-3" aria-hidden />
              Add table
            </button>
          ) : null}
        </div>
      ) : null}

      {mode === "union" || mode === "join" || mode === "single" || mode === "output_only" ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">
            Output table{outputOptional ? "" : " *"}
          </span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            {mode === "single" && outputOptional
              ? "Where results are written — leave blank to overwrite the input table"
              : mode === "output_only"
                ? "Warehouse table for persisted results (if this step writes rows)"
                : "Where this step writes its result"}
          </span>
          <PipelineTableAssetPicker
            pipelineId={pipelineId}
            value={outputRef}
            readOnly={readOnly}
            placeholder={outputOptional ? "schema.table (optional)" : "schema.table"}
            onChange={(ref, asset) => patchTable("output_table", ref, asset)}
          />
        </label>
      ) : null}
    </div>
  );
}

/** @deprecated Use OperatorStepIoPanel */
export const TransformStepIoPanel = OperatorStepIoPanel;
