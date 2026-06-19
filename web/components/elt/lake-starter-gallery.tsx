"use client";

import { useState } from "react";
import { Layers, Loader2, Sparkles, X } from "lucide-react";
import clsx from "clsx";
import {
  LAKE_PIPELINE_STARTERS,
  lakeStarterCanvasGraph,
  type LakePipelineStarter,
} from "@/lib/elt/lake-pipeline-starters";
import type { Edge, Node } from "@xyflow/react";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

type ApplyResult = {
  nodes: Node[];
  edges: Edge[];
  title: string;
  stepCount: number;
};

type Props = {
  /** Apply starter graph to canvas (parent saves). */
  onApplyToCanvas?: (result: ApplyResult) => void;
  /** Navigate-only mode for catalog page. */
  canvasHref?: (starterId: string) => string;
  defaultSourceTable?: string;
  existingCanvas?: PipelineCanvasGraph | null;
  compact?: boolean;
  className?: string;
  requirePipeline?: boolean;
};

function needsDimension(starter: LakePipelineStarter): boolean {
  return starter.id === "single_source_enrich" || starter.id === "entity_360_profile";
}

function needsSecondSource(starter: LakePipelineStarter): boolean {
  return starter.sourceCount === 2;
}

export function LakeStarterGallery({
  onApplyToCanvas,
  canvasHref,
  defaultSourceTable = "staging.events",
  existingCanvas,
  compact = false,
  className,
  requirePipeline = false,
}: Props) {
  const [active, setActive] = useState<LakePipelineStarter | null>(null);
  const [sourceTable, setSourceTable] = useState(defaultSourceTable);
  const [secondTable, setSecondTable] = useState("staging.source_b");
  const [dimensionTable, setDimensionTable] = useState("dimensions.entities");
  const [joinKey, setJoinKey] = useState("entity_id");
  const [layerPrefix, setLayerPrefix] = useState("marts");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function openStarter(starter: LakePipelineStarter) {
    setActive(starter);
    setError(null);
    setSourceTable(defaultSourceTable);
  }

  function closeModal() {
    setActive(null);
    setError(null);
  }

  function handleApply() {
    if (!active) return;
    if (requirePipeline && !onApplyToCanvas) {
      setError("Select a pipeline on the canvas first.");
      return;
    }
    const table = sourceTable.trim();
    if (!table) {
      setError("Source table is required (e.g. staging.orders).");
      return;
    }

    if (canvasHref && !onApplyToCanvas) {
      window.location.href = canvasHref(active.id);
      return;
    }

    setBusy(true);
    setError(null);
    try {
      const result = lakeStarterCanvasGraph({
        starter_id: active.id,
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
      onApplyToCanvas?.({
        nodes: result.nodes,
        edges: result.edges,
        title: result.title,
        stepCount: result.components.length,
      });
      closeModal();
    } finally {
      setBusy(false);
    }
  }

  return (
    <section className={clsx("space-y-3", className)}>
      <div className="flex items-center gap-2">
        <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
        <h2 className={clsx("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-base")}>
          Pipeline recipes
        </h2>
        <span className="text-xs text-slate-500">single-lake · click to configure</span>
      </div>

      <div className={clsx("grid gap-2", compact ? "grid-cols-1" : "sm:grid-cols-2")}>
        {LAKE_PIPELINE_STARTERS.map((starter) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => openStarter(starter)}
            className="rounded-xl border border-slate-200 bg-white p-3 text-left transition hover:border-violet-300 hover:shadow-sm dark:border-slate-700 dark:bg-slate-950 dark:hover:border-violet-700"
          >
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">{starter.title}</p>
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                {starter.sourceCount === "many" ? "multi" : `${starter.sourceCount} src`}
              </span>
            </div>
            <p className="mt-1 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">{starter.description}</p>
            <p className="mt-2 text-[10px] font-medium text-violet-600 dark:text-violet-400">
              {starter.components({ source_table: "staging.example" }).length} steps · warehouse SQL
            </p>
          </button>
        ))}
      </div>

      {active ? (
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
                  {active.title}
                </h3>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{active.description}</p>

            <div className="mt-4 space-y-3">
              <label className="block text-sm">
                <span className="font-medium text-slate-700 dark:text-slate-300">Loaded source table</span>
                <input
                  value={sourceTable}
                  onChange={(e) => setSourceTable(e.target.value)}
                  placeholder="staging.orders"
                  className="mt-1 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950"
                />
              </label>
              {needsSecondSource(active) ? (
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
              {needsDimension(active) ? (
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
              {active.components({ source_table: sourceTable || "staging.example" }).map((c, i) => (
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
                {onApplyToCanvas ? "Add to canvas" : "Open canvas"}
              </button>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg border border-slate-300 px-4 py-2 text-sm dark:border-slate-600"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </section>
  );
}
