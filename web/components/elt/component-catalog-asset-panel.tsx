"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { ExternalLink, Loader2 } from "lucide-react";
import { CatalogAssetPicker } from "@/components/catalog/catalog-asset-picker";
import { PipelineTableAssetPicker } from "@/components/elt/pipeline-table-asset-picker";
import {
  CATALOG_INPUT_KEYS,
  CATALOG_OUTPUT_KEY,
  applyInputCatalogAssets,
  applyPickedAssetToConfig,
  resolveCatalogAssetId,
} from "@/lib/elt/catalog-asset-link";
import { assetDetailHref } from "@/lib/elt/asset-path";
import type { WorkspaceAsset, WorkspaceAssetsResponse } from "@/lib/elt/pipeline-assets";
import { tableRefFromAsset } from "@/lib/elt/table-asset-fields";

type Props = {
  pipelineId: string;
  config: Record<string, unknown>;
  readOnly?: boolean;
  onChange: (next: Record<string, unknown>) => void;
};

/** Links component config to workspace catalog assets (output + upstream inputs). */
export function ComponentCatalogAssetPanel({ pipelineId, config, readOnly = false, onChange }: Props) {
  const [assets, setAssets] = useState<WorkspaceAsset[]>([]);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ pipelineId });
      const res = await fetch(`/api/elt/assets?${qs}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const body = (await res.json()) as WorkspaceAssetsResponse;
      setAssets(body.assets ?? []);
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const assetsById = useMemo(() => new Map(assets.map((a) => [a.id, a])), [assets]);

  const outputRef = String(
    config.output_table ?? config.table ?? config.table_name ?? config.asset_key ?? ""
  ).trim();
  const outputCatalogId = resolveCatalogAssetId(config, assets, "output");
  const outputAsset = outputCatalogId ? assetsById.get(outputCatalogId) : undefined;

  const inputCatalogIds = Array.isArray(config[CATALOG_INPUT_KEYS])
    ? (config[CATALOG_INPUT_KEYS] as unknown[]).map(String).filter(Boolean)
    : [];

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading catalog assets…
      </p>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-sky-200 bg-sky-50/50 p-3 dark:border-sky-900 dark:bg-sky-950/20">
      <div>
        <p className="text-xs font-semibold text-sky-800 dark:text-sky-200">Catalog asset linking</p>
        <p className="mt-0.5 text-[10px] text-slate-600 dark:text-slate-400">
          Binds this step to workspace assets — <code className="text-[9px]">landingQualified</code> ↔ catalog id.
        </p>
      </div>

      <label className="block text-sm">
        <span className="font-medium text-slate-700 dark:text-slate-300">Output asset</span>
        <PipelineTableAssetPicker
          pipelineId={pipelineId}
          value={outputRef}
          readOnly={readOnly}
          placeholder="schema.table or pick from catalog"
          onChange={(tableRef, asset) =>
            onChange(applyPickedAssetToConfig(config, "output_table", tableRef, asset))
          }
        />
        {outputCatalogId ? (
          <Link
            href={assetDetailHref(outputCatalogId)}
            className="mt-1 inline-flex items-center gap-1 text-[10px] font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            {outputAsset?.displayName ?? outputCatalogId}
            <ExternalLink className="h-3 w-3" aria-hidden />
          </Link>
        ) : outputRef ? (
          <p className="mt-1 font-mono text-[10px] text-slate-500">{outputRef}</p>
        ) : null}
      </label>

      <div>
        <p className="text-xs font-medium text-slate-700 dark:text-slate-300">Upstream inputs</p>
        <p className="text-[10px] text-slate-500">Tables or assets this step reads from</p>
        <CatalogAssetPicker
          pipelineId={pipelineId}
          selected={inputCatalogIds}
          onChange={(ids) => onChange(applyInputCatalogAssets(config, ids, assetsById))}
          maxHeight="max-h-36"
          readOnly={readOnly}
        />
        {inputCatalogIds.length > 0 ? (
          <ul className="mt-2 space-y-1">
            {inputCatalogIds.map((id) => {
              const a = assetsById.get(id);
              return (
                <li key={id}>
                  <Link
                    href={assetDetailHref(id)}
                    className="inline-flex items-center gap-1 font-mono text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {a ? tableRefFromAsset(a) : id}
                    <ExternalLink className="h-2.5 w-2.5" aria-hidden />
                  </Link>
                </li>
              );
            })}
          </ul>
        ) : null}
      </div>
    </div>
  );
}
