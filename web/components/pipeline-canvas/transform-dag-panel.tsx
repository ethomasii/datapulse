"use client";

import { useMemo } from "react";
import type { Edge, Node } from "@xyflow/react";
import { GitBranch, Layers } from "lucide-react";
import { deriveTransformDag } from "@/lib/elt/transform-dag";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";

type TransformDagPanelProps = {
  nodes: Node[];
  edges: Edge[];
  specComponents?: PipelineComponentSpec[] | null;
  pipelineName?: string;
};

export function TransformDagPanel({ nodes, edges, specComponents, pipelineName }: TransformDagPanelProps) {
  const dag = useMemo(
    () => deriveTransformDag(nodes, edges, specComponents, { pipelineName }),
    [nodes, edges, specComponents, pipelineName]
  );

  if (!dag.nodes.length) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-6 text-center dark:border-slate-600 dark:bg-slate-900/50">
        <Layers className="mx-auto mb-2 h-8 w-8 text-slate-400" aria-hidden />
        <p className="text-sm font-medium text-slate-700 dark:text-slate-300">No transform DAG yet</p>
        <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
          Add component nodes on the designer canvas (join, filter, aggregate, checks) — edges define execution order
          like Lakeflow DT dependencies.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-white">
        <GitBranch className="h-4 w-4 text-sky-600 dark:text-sky-400" aria-hidden />
        Transform DAG
        <span className="rounded-full bg-sky-100 px-2 py-0.5 text-[11px] font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
          {dag.nodes.length} step{dag.nodes.length === 1 ? "" : "s"}
        </span>
      </div>
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Topological execution order from canvas edges → declarative <code className="text-[11px]">components[].after</code>.
        Output assets chain downstream inputs (Lakeflow-style DT lineage).
      </p>

      <div className="space-y-3">
        {dag.layers.map((layer, li) => (
          <div key={`layer-${li}`}>
            {dag.layers.length > 1 ? (
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                Layer {li + 1}
              </p>
            ) : null}
            <div className="flex flex-wrap gap-2">
              {layer.map((specId) => {
                const n = dag.nodes.find((x) => x.specId === specId);
                if (!n) return null;
                return (
                  <div
                    key={n.specId}
                    className="min-w-[10rem] max-w-xs flex-1 rounded-lg border border-slate-200 bg-white p-3 shadow-sm dark:border-slate-700 dark:bg-slate-950"
                  >
                    <div className="flex items-start justify-between gap-2">
                      <p className="text-sm font-medium text-slate-900 dark:text-white">{n.label}</p>
                      <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] text-slate-600 dark:bg-slate-800 dark:text-slate-300">
                        #{n.order}
                      </span>
                    </div>
                    <p className="mt-0.5 font-mono text-[10px] text-violet-600 dark:text-violet-400">{n.componentId}</p>
                    {n.assetKey ? (
                      <p className="mt-1 font-mono text-[10px] text-emerald-700 dark:text-emerald-400">{n.assetKey}</p>
                    ) : null}
                    {n.outputAsset && n.outputAsset !== n.assetKey ? (
                      <p className="mt-2 text-[11px] text-slate-600 dark:text-slate-400">
                        → <span className="font-mono text-emerald-700 dark:text-emerald-400">{n.outputAsset}</span>
                      </p>
                    ) : null}
                    {n.inputAssets.length ? (
                      <p className="mt-1 text-[10px] text-slate-500">
                        ← {n.inputAssets.join(", ")}
                      </p>
                    ) : null}
                  </div>
                );
              })}
            </div>
            {li < dag.layers.length - 1 ? (
              <div className="my-2 flex justify-center text-slate-300 dark:text-slate-600">↓</div>
            ) : null}
          </div>
        ))}
      </div>

      {dag.edges.length > 0 ? (
        <details className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-900/50">
          <summary className="cursor-pointer text-xs font-medium text-slate-600 dark:text-slate-400">
            Mermaid diagram (export)
          </summary>
          <pre className="mt-2 overflow-x-auto text-[10px] text-slate-700 dark:text-slate-300">{dag.mermaid}</pre>
        </details>
      ) : null}
    </div>
  );
}
