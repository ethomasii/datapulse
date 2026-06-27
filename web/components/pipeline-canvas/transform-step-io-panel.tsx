"use client";

import { applyPickedAssetToConfig } from "@/lib/elt/catalog-asset-link";
import { PipelineTableAssetPicker } from "@/components/elt/pipeline-table-asset-picker";
import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";

type Props = {
  pipelineId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  showOutput?: boolean;
  onChange: (next: Record<string, unknown>) => void;
};

/** Single input/output table section — replaces duplicate catalog + schema fields on canvas. */
export function TransformStepIoPanel({
  pipelineId,
  config,
  readOnly = false,
  showOutput = true,
  onChange,
}: Props) {
  const inputRef = String(config.table ?? config.input_table ?? "").trim();
  const outputRef = String(config.output_table ?? "").trim();

  function setInput(tableRef: string, asset?: Pick<WorkspaceAsset, "id" | "landingQualified" | "displayName" | "name">) {
    let next = applyPickedAssetToConfig(config, "table", tableRef, asset);
    next = { ...next, input_table: tableRef };
    onChange(next);
  }

  function setOutput(tableRef: string, asset?: Pick<WorkspaceAsset, "id" | "landingQualified" | "displayName" | "name">) {
    onChange(applyPickedAssetToConfig(config, "output_table", tableRef, asset));
  }

  return (
    <div className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/40">
      <div>
        <p className="text-xs font-semibold text-slate-800 dark:text-slate-100">Tables</p>
        <p className="mt-0.5 text-[10px] text-slate-500">
          Wire an upstream node on the graph to auto-fill the input table, or pick from this pipeline.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Input table *</span>
        <span className="mt-0.5 block text-[11px] text-slate-500">Table this step reads from</span>
        <PipelineTableAssetPicker
          pipelineId={pipelineId}
          value={inputRef}
          readOnly={readOnly}
          placeholder="schema.table"
          onChange={setInput}
        />
      </label>

      {showOutput ? (
        <label className="block text-sm">
          <span className="font-medium text-slate-700 dark:text-slate-300">Output table</span>
          <span className="mt-0.5 block text-[11px] text-slate-500">
            Where results are written — leave blank to overwrite the input table
          </span>
          <PipelineTableAssetPicker
            pipelineId={pipelineId}
            value={outputRef}
            readOnly={readOnly}
            placeholder="schema.table (optional)"
            onChange={setOutput}
          />
        </label>
      ) : null}
    </div>
  );
}
