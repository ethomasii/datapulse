"use client";

import Link from "next/link";
import { useMemo } from "react";
import type { Node } from "@xyflow/react";
import { ArrowRight, Database, Layers, Table2 } from "lucide-react";
import { CanvasAssetLineagePanel } from "@/components/pipeline-canvas/canvas-asset-lineage-panel";
import { assetDetailHref } from "@/lib/elt/asset-path";
import { derivePipelineAssets } from "@/lib/elt/pipeline-assets";
import { tableRefFromAsset } from "@/lib/elt/table-asset-fields";

type IngestPanelProps = {
  pipelineId: string;
  pipelineName: string;
  tool: string;
  sourceType: string;
  destinationType: string;
  sourceConfiguration: Record<string, unknown>;
  canvasNodes: Node[];
  onSwitchToDesigner?: () => void;
};

function ingestResourcesFromConfig(
  sourceType: string,
  config: Record<string, unknown>
): string[] {
  if (Array.isArray(config.resources)) return config.resources.map(String).filter(Boolean);
  if (Array.isArray(config.tables)) return config.tables.map(String).filter(Boolean);
  if (typeof config.tables === "string" && config.tables.trim()) {
    return config.tables.split(",").map((s) => s.trim()).filter(Boolean);
  }
  if (sourceType === "github" && Array.isArray(config.repos)) {
    return config.repos.map(String);
  }
  return [];
}

export function IngestPanel({
  pipelineId,
  pipelineName,
  tool,
  sourceType,
  destinationType,
  sourceConfiguration,
  canvasNodes,
  onSwitchToDesigner,
}: IngestPanelProps) {
  const bundle = useMemo(
    () =>
      derivePipelineAssets({
        id: pipelineId,
        name: pipelineName,
        tool,
        enabled: true,
        sourceType,
        destinationType,
        sourceConfiguration,
        updatedAt: new Date().toISOString(),
      }),
    [pipelineId, pipelineName, tool, sourceType, destinationType, sourceConfiguration]
  );

  const resources = useMemo(
    () => ingestResourcesFromConfig(sourceType, sourceConfiguration),
    [sourceType, sourceConfiguration]
  );

  const ingestComponents = useMemo(
    () =>
      canvasNodes.filter((n) => {
        if (n.type !== "componentNode") return false;
        const d = n.data as { category?: string; componentId?: string };
        return d.category === "ingestion" || String(d.componentId ?? "").includes("ingest");
      }),
    [canvasNodes]
  );

  const syncLabel = bundle.syncMode === "database_replication" ? "Database replication" : "Connector sync";

  return (
    <div className="min-h-[max(28rem,min(calc(100dvh-8rem),56rem))] space-y-4 rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-950">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-emerald-600 dark:text-emerald-400">
            Ingest
          </p>
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{pipelineName}</h2>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium">{sourceType.replace(/_/g, " ")}</span>
            <ArrowRight className="mx-1.5 inline h-3.5 w-3.5" aria-hidden />
            <span className="font-medium">{destinationType.replace(/_/g, " ")}</span>
            <span className="ml-2 rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {syncLabel}
            </span>
          </p>
          <p className="mt-1 font-mono text-[11px] text-slate-500">
            Landing dataset: {bundle.landingDataset}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {onSwitchToDesigner ? (
            <button
              type="button"
              onClick={onSwitchToDesigner}
              className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
            >
              Open in Designer
            </button>
          ) : null}
          <Link
            href={`/assets?pipeline=${encodeURIComponent(pipelineId)}`}
            className="inline-flex items-center gap-1 rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-xs font-medium text-sky-700 hover:bg-sky-100 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-300"
          >
            <Database className="h-3.5 w-3.5" aria-hidden />
            Asset catalog
          </Link>
        </div>
      </div>

      <CanvasAssetLineagePanel
        pipelineId={pipelineId}
        pipelineName={pipelineName}
        tool={tool}
        sourceType={sourceType}
        destinationType={destinationType}
        sourceConfiguration={sourceConfiguration}
      />

      <div className="grid gap-4 lg:grid-cols-2">
        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex items-center gap-2">
            <Table2 className="h-4 w-4 text-slate-500" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Source resources</h3>
          </div>
          {resources.length > 0 ? (
            <ul className="space-y-1">
              {resources.map((r) => (
                <li key={r} className="font-mono text-xs text-slate-700 dark:text-slate-300">
                  {r}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">
              No tables/resources declared — configure the source connector in the sidebar.
            </p>
          )}
        </section>

        <section className="rounded-xl border border-slate-200 p-4 dark:border-slate-700">
          <div className="mb-3 flex items-center gap-2">
            <Layers className="h-4 w-4 text-slate-500" aria-hidden />
            <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Landing tables</h3>
          </div>
          {bundle.rawAssets.length > 0 ? (
            <ul className="max-h-48 space-y-2 overflow-y-auto">
              {bundle.rawAssets.map((a) => (
                <li key={a.id} className="rounded-lg border border-slate-100 px-2 py-1.5 dark:border-slate-800">
                  <Link
                    href={assetDetailHref(a.id)}
                    className="block text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {a.displayName}
                  </Link>
                  <span className="block font-mono text-[10px] text-slate-500">
                    {tableRefFromAsset(a)}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-xs text-slate-500">Run the pipeline or save source config to derive landing tables.</p>
          )}
        </section>
      </div>

      {ingestComponents.length > 0 ? (
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/40 p-4 dark:border-emerald-900 dark:bg-emerald-950/20">
          <h3 className="text-sm font-semibold text-emerald-900 dark:text-emerald-200">
            Ingestion components on canvas
          </h3>
          <p className="mt-1 text-xs text-emerald-800/80 dark:text-emerald-300/80">
            These compile into source configuration patches on save.
          </p>
          <ul className="mt-3 space-y-2">
            {ingestComponents.map((n) => {
              const d = n.data as { label?: string; componentId?: string };
              return (
                <li
                  key={n.id}
                  className="flex items-center justify-between gap-2 rounded-lg border border-emerald-200/60 bg-white px-3 py-2 dark:border-emerald-900 dark:bg-slate-950"
                >
                  <span className="text-sm font-medium text-slate-900 dark:text-white">
                    {d.label ?? d.componentId ?? n.id}
                  </span>
                  <code className="font-mono text-[10px] text-slate-500">{d.componentId}</code>
                </li>
              );
            })}
          </ul>
        </section>
      ) : null}
    </div>
  );
}
