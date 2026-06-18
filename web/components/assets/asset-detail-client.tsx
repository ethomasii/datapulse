"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  ArrowRight,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
  Table2,
} from "lucide-react";
import { AssetCatalogMetaEditor } from "@/components/assets/asset-catalog-meta-editor";
import {
  AssetFreshnessBadge,
  AssetKindBadge,
  AssetNameLink,
  WarehouseStatusBadge,
} from "@/components/assets/asset-display";
import { AssetLineageGraph } from "@/components/assets/asset-lineage-graph";
import { RelatedLinks } from "@/components/ui/related-links";
import { buildAssetLineageGraph } from "@/lib/elt/asset-lineage";
import { computePipelineFreshness } from "@/lib/elt/asset-freshness";
import { syncModeLabel } from "@/lib/elt/pipeline-tool-labels";
import type { PipelineAssetBundle, WorkspaceAsset } from "@/lib/elt/pipeline-assets";

type AssetDetailResponse = {
  asset: WorkspaceAsset;
  bundle: PipelineAssetBundle;
};

function DetailRow({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="grid gap-1 border-b border-slate-100 py-3 last:border-0 dark:border-slate-800 sm:grid-cols-3">
      <dt className="text-xs font-semibold uppercase tracking-wide text-slate-500">{label}</dt>
      <dd className="text-sm text-slate-900 dark:text-white sm:col-span-2">{value}</dd>
    </div>
  );
}

function formatRelative(iso: string | null | undefined): string {
  if (!iso) return "—";
  const ms = Date.parse(iso);
  if (Number.isNaN(ms)) return "—";
  const diff = Date.now() - ms;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 48) return `${hours}h ago`;
  return `${Math.floor(hours / 24)}d ago`;
}

export function AssetDetailClient({ assetKey }: { assetKey: string }) {
  const [data, setData] = useState<AssetDetailResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/assets?assetKey=${encodeURIComponent(assetKey)}`);
      if (res.status === 404) throw new Error("Asset not found");
      if (!res.ok) throw new Error("Failed to load asset");
      setData((await res.json()) as AssetDetailResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [assetKey]);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" /> Loading asset…
      </div>
    );
  }

  if (error || !data) {
    return (
      <div className="space-y-4">
        <Link href="/assets" className="inline-flex items-center gap-1 text-sm text-sky-600 hover:underline dark:text-sky-400">
          <ArrowLeft className="h-4 w-4" /> Back to assets
        </Link>
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error ?? "Asset not found"}
        </div>
      </div>
    );
  }

  const { asset, bundle } = data;
  const freshness = computePipelineFreshness(bundle.lastRun, bundle.enabled);
  const lineage = buildAssetLineageGraph(bundle);
  const siblings = [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms].filter(
    (a) => a.id !== asset.id
  );

  return (
    <div className="mx-auto w-full min-w-0 max-w-5xl space-y-8">
      <nav className="flex flex-wrap items-center gap-2 text-sm text-slate-500">
        <Link href="/assets" className="hover:text-sky-600 dark:hover:text-sky-400">
          Assets
        </Link>
        <span aria-hidden>/</span>
        <Link
          href={`/assets?pipeline=${encodeURIComponent(asset.pipelineId)}`}
          className="hover:text-sky-600 dark:hover:text-sky-400"
        >
          {asset.pipelineName}
        </Link>
        <span aria-hidden>/</span>
        <span className="font-medium text-slate-900 dark:text-white">{asset.displayName}</span>
      </nav>

      <header className="space-y-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <AssetKindBadge kind={asset.kind} />
              <WarehouseStatusBadge status={asset.warehouseStatus} runObserved={asset.runObserved} />
              <AssetFreshnessBadge meta={asset.assetFreshness} />
              {asset.transformScope === "post_replication" ? (
                <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-950/50">
                  Post-replication
                </span>
              ) : null}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 dark:text-white">
              {asset.catalogDisplayName ?? asset.displayName}
            </h1>
            {asset.catalogDisplayName && asset.catalogDisplayName !== asset.displayName ? (
              <p className="text-sm text-slate-500">Config name: {asset.displayName}</p>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-2">
            <Link
              href={`/builder?pipeline=${asset.pipelineId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
            >
              <Layers className="h-4 w-4" /> Pipeline
            </Link>
            <Link
              href={`/runs?pipeline=${asset.pipelineId}`}
              className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
            >
              <PlayCircle className="h-4 w-4" /> Runs
            </Link>
          </div>
        </div>
      </header>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Catalog metadata</h2>
            <p className="mt-1 text-sm text-slate-500">
              Description and tags for data consumers browsing the workspace catalog.
            </p>
            <div className="mt-4">
              <AssetCatalogMetaEditor
                variant="detail"
                assetKey={asset.id}
                kind={asset.kind}
                pipelineId={asset.pipelineId}
                initialDescription={asset.catalogDescription ?? ""}
                initialTags={asset.catalogTags ?? []}
                onSaved={load}
              />
            </div>
          </section>

          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Technical details</h2>
            <dl className="mt-3">
              <DetailRow label="Asset ID" value={<code className="break-all font-mono text-xs">{asset.id}</code>} />
              <DetailRow
                label="Landing target"
                value={
                  asset.landingQualified ?? asset.landingDataset ? (
                    <code className="break-all font-mono text-xs">
                      {asset.landingQualified ?? asset.landingDataset}
                    </code>
                  ) : (
                    "—"
                  )
                }
              />
              <DetailRow label="Source connector" value={asset.sourceType} />
              <DetailRow label="Destination" value={asset.destinationType} />
              <DetailRow label="Sync mode" value={syncModeLabel(asset.syncMode)} />
              {asset.dbtPackage ? (
                <DetailRow label="dbt package" value={asset.dbtPackage.replace(/^dlt-hub\//, "")} />
              ) : null}
              {asset.description ? <DetailRow label="Config notes" value={asset.description} /> : null}
            </dl>
          </section>

          <AssetLineageGraph graph={lineage} highlightAssetId={asset.id} linkNodes />
        </div>

        <aside className="space-y-6">
          <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline</h2>
            <p className="mt-2 font-medium text-slate-900 dark:text-white">{bundle.pipelineName}</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              {bundle.sourceType} → {bundle.destinationType}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {syncModeLabel(bundle.syncMode)} · {bundle.landingDataset}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${freshness.badgeClass}`}>
                {freshness.label}
              </span>
              {!bundle.enabled ? (
                <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800">
                  Disabled
                </span>
              ) : null}
            </div>
            {bundle.lastRun ? (
              <p className="mt-3 text-xs text-slate-500">
                Last run{" "}
                <span
                  className={
                    bundle.lastRun.status === "succeeded"
                      ? "text-emerald-600 dark:text-emerald-400"
                      : bundle.lastRun.status === "failed"
                        ? "text-red-600 dark:text-red-400"
                        : "text-sky-600 dark:text-sky-400"
                  }
                >
                  {bundle.lastRun.status}
                </span>{" "}
                {formatRelative(bundle.lastRun.finishedAt ?? bundle.lastRun.startedAt)}
              </p>
            ) : (
              <p className="mt-3 text-xs text-slate-500">No runs yet</p>
            )}
          </section>

          {siblings.length > 0 ? (
            <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Related assets</h2>
              <ul className="mt-3 space-y-2">
                {siblings.map((s) => (
                  <li key={s.id} className="flex items-center justify-between gap-2 text-sm">
                    <div className="min-w-0">
                      <AssetNameLink assetKey={s.id} displayName={s.displayName} className="text-sm" />
                      <div className="mt-0.5">
                        <AssetKindBadge kind={s.kind} />
                      </div>
                    </div>
                    <ArrowRight className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
                  </li>
                ))}
              </ul>
            </section>
          ) : null}
        </aside>
      </div>

      <RelatedLinks
        links={[
          { href: "/catalog", icon: Table2, label: "Catalog", desc: "Workspace inventory hub" },
          { href: "/catalog/dbt", icon: GitBranch, label: "dbt projects", desc: "Transform projects and runs" },
          { href: `/assets?pipeline=${asset.pipelineId}`, icon: Layers, label: "Pipeline assets", desc: "All assets in this pipeline" },
        ]}
      />
    </div>
  );
}
