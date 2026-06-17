"use client";

import Link from "next/link";
import { useMemo } from "react";
import { ArrowRight, Database } from "lucide-react";
import { AssetLineageGraph } from "@/components/assets/asset-lineage-graph";
import { buildAssetLineageGraph } from "@/lib/elt/asset-lineage";
import { derivePipelineAssets } from "@/lib/elt/pipeline-assets";

type CanvasAssetLineagePanelProps = {
  pipelineId: string;
  pipelineName: string;
  tool: string;
  sourceType: string;
  destinationType: string;
  sourceConfiguration: Record<string, unknown>;
};

export function CanvasAssetLineagePanel({
  pipelineId,
  pipelineName,
  tool,
  sourceType,
  destinationType,
  sourceConfiguration,
}: CanvasAssetLineagePanelProps) {
  const graph = useMemo(() => {
    const bundle = derivePipelineAssets({
      id: pipelineId,
      name: pipelineName,
      tool,
      enabled: true,
      sourceType,
      destinationType,
      sourceConfiguration,
      updatedAt: new Date().toISOString(),
    });
    return buildAssetLineageGraph(bundle);
  }, [pipelineId, pipelineName, tool, sourceType, destinationType, sourceConfiguration]);

  const assetCount =
    1 +
    graph.nodes.filter((n) => n.kind === "raw").length +
    graph.nodes.filter((n) => n.kind === "transform").length;

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 dark:border-slate-700 dark:bg-slate-900">
      <div className="mb-3 flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Database className="h-4 w-4 shrink-0" aria-hidden />
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide">Data map</p>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {assetCount} asset{assetCount === 1 ? "" : "s"} from saved config
            </p>
          </div>
        </div>
        <Link
          href={`/assets?pipeline=${encodeURIComponent(pipelineId)}`}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          Catalog <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
      <AssetLineageGraph graph={graph} />
    </div>
  );
}
