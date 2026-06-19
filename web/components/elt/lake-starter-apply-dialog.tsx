"use client";

import { useState } from "react";
import { Layers, Loader2, X } from "lucide-react";
import {
  lakeStarterCanvasGraph,
  type LakePipelineStarter,
} from "@/lib/elt/lake-pipeline-starters";
import { MEDALLION_LAYER_EXPLAINER, WAREHOUSE_COMPUTE_HINT } from "@/lib/elt/lake-defaults";
import type { Edge, Node } from "@xyflow/react";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

export type LakeStarterApplyResult = {
  nodes: Node[];
  edges: Edge[];
  title: string;
  stepCount: number;
  starterId: string;
  medallion?: { landing: string; transform: string };
};

type Props = {
  starter: LakePipelineStarter;
  onClose: () => void;
  onApply?: (result: LakeStarterApplyResult) => void;
  onNavigate?: (starterId: string, params: { source_table: string }) => void;
  defaultSourceTable?: string;
  existingCanvas?: PipelineCanvasGraph | null;
  applyLabel?: string;
};

export function needsDimension(starter: LakePipelineStarter): boolean {
  return starter.id === "single_source_enrich" || starter.id === "entity_360_profile";
}

export function needsSecondSource(starter: LakePipelineStarter): boolean {
  return starter.sourceCount === 2;
}

export function LakeStarterApplyDialog({
  starter,
  onClose,
  onApply,
  onNavigate,
  defaultSourceTable = "staging.events",
  existingCanvas,
  applyLabel = "Add to canvas",
}: Props) {
  const [sourceTable, setSourceTable] = useState(defaultSourceTable);
  const [secondTable, setSecondTable] = useState("staging.source_b");
  const [dimensionTable, setDimensionTable] = useState("dimensions.entities");
  const [joinKey, setJoinKey] = useState("entity_id");
  const [layerPrefix, setLayerPrefix] = useState("marts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleApply() {
    const table = sourceTable.trim();
    if (!table) {
      setError("Source table is required (e.g. staging.orders).");
      return;
    }

    if (onNavigate && !onApply) {
      onNavigate(starter.id, { source_table: table });
      onClose();
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = lakeStarterCanvasGraph({
        starter_id: starter.id,
        source_table: table,
        second_table: secondTable.trim() || undefined,
        dimension_table: dimensionTable.trim() || undefined,
        layer_prefix: layerPrefix.trim() || undefined,
        join_key: joinKey.trim() || undefined,
        existingCanvas,
      });
      if (!result.nodes.length) {
        setError(result.messages[0] ?? "Could not build starter.");
        return;
      }
      onApply?.({
        nodes: result.nodes,
        edges: result.edges,
        title: result.title,
        stepCount: result.components.length,
        starterId: starter.id,
        ...(result.medallion ? { medallion: result.medallion } : {}),
      });
      onClose();
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lake-starter-title"
    >
      <div className="max-h-[90vh] w-full max-w-md overflow-y-auto rounded-xl border border-slate-200 bg-white p-5 shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-start justify-between gap-2">
          <div>
            <p className="text-[10px] font-semibold uppercase text-violet-600">Recipe</p>
            <h3 id="lake-starter-title" className="text-lg font-semibold text-slate-900 dark:text-white">
              {starter.title}
            </h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{starter.description}</p>
        <p className="mt-2 text-xs text-slate-500">{WAREHOUSE_COMPUTE_HINT}</p>
        {starter.id === "single_lake_medallion" ? (
          <p className="mt-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 text-xs text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
            {MEDALLION_LAYER_EXPLAINER}
          </p>
        ) : null}

        <div className="mt-4 space-y-3">
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Loaded table (after ingest)</span>
            <span className="mt-0.5 block text-xs font-normal text-slate-500">
              Schema.table on your destination — same lake for bronze through gold
            </span>
            <input
              value={sourceTable}
              onChange={(e) => setSourceTable(e.target.value)}
              placeholder="staging.orders"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
          {needsSecondSource(starter) ? (
            <label className="block text-sm">
              <span className="font-medium text-slate-700 dark:text-slate-300">Second source table</span>
              <input
                value={secondTable}
                onChange={(e) => setSecondTable(e.target.value)}
                placeholder="staging.source_b"
                className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
              />
            </label>
          ) : null}
          {needsDimension(starter) ? (
            <>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Dimension table</span>
                <input
                  value={dimensionTable}
                  onChange={(e) => setDimensionTable(e.target.value)}
                  placeholder="dimensions.entities"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Join key</span>
                <input
                  value={joinKey}
                  onChange={(e) => setJoinKey(e.target.value)}
                  placeholder="entity_id"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
            </>
          ) : null}
          <label className="block text-sm">
            <span className="font-medium text-slate-700 dark:text-slate-300">Output schema prefix</span>
            <input
              value={layerPrefix}
              onChange={(e) => setLayerPrefix(e.target.value)}
              placeholder="marts"
              className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
            />
          </label>
        </div>

        <ul className="mt-4 space-y-1 rounded-lg bg-slate-50 p-3 text-xs text-slate-600 dark:bg-slate-950 dark:text-slate-400">
          {starter.components({ source_table: sourceTable || "staging.example" }).map((c, i) => (
            <li key={`${c.component_id}-${i}`} className="flex items-center gap-2">
              <Layers className="h-3 w-3 shrink-0" aria-hidden />
              <span className="font-medium">{c.label ?? c.component_id}</span>
              <span className="text-slate-400">({c.component_id})</span>
            </li>
          ))}
        </ul>

        {error ? (
          <p className="mt-3 text-sm text-red-600 dark:text-red-400" role="alert">
            {error}
          </p>
        ) : null}

        <div className="mt-4 flex gap-2">
          <button
            type="button"
            disabled={busy}
            onClick={handleApply}
            className="flex flex-1 items-center justify-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-medium text-white hover:bg-violet-500 disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {applyLabel}
          </button>
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  );
}
