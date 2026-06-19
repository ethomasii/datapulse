"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import {
  ChevronRight,
  Database,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
  RefreshCw,
  Search,
  Table2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import { AddTransformsCta } from "@/components/elt/add-transforms-cta";
import { PipelineHealthPanel } from "@/components/catalog/pipeline-health-panel";
import { RelatedLinks } from "@/components/ui/related-links";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";
import {
  AssetFreshnessBadge,
  AssetKindBadge,
  MedallionLayerBadge,
  AssetCatalogPreview,
  WarehouseStatusBadge,
} from "@/components/assets/asset-display";
import { AssetLineageGraph } from "@/components/assets/asset-lineage-graph";
import { buildAssetLineageGraph } from "@/lib/elt/asset-lineage";
import { computePipelineFreshness } from "@/lib/elt/asset-freshness";
import { assetDetailHref } from "@/lib/elt/asset-path";
import { syncModeLabel } from "@/lib/elt/pipeline-tool-labels";
import type { WarehouseVerificationSummary } from "@/lib/elt/asset-warehouse-reconcile";
import type { PipelineHealthSummary } from "@/lib/elt/pipeline-health";
import type {
  PipelineAssetBundle,
  WorkspaceAsset,
  WorkspaceAssetKind,
  WorkspaceAssetsResponse,
} from "@/lib/elt/pipeline-assets";

type AssetsPageData = WorkspaceAssetsResponse & {
  warehouseVerification?: WarehouseVerificationSummary;
};

type ViewMode = "pipelines" | "flat";
type KindFilter = "all" | WorkspaceAssetKind;

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

function matchesQuery(text: string, q: string): boolean {
  return text.toLowerCase().includes(q);
}

function assetMatches(asset: WorkspaceAsset, q: string): boolean {
  return (
    matchesQuery(asset.name, q) ||
    matchesQuery(asset.displayName, q) ||
    matchesQuery(asset.pipelineName, q) ||
    matchesQuery(asset.sourceType, q) ||
    matchesQuery(asset.destinationType, q) ||
    matchesQuery(asset.landingQualified ?? "", q) ||
    matchesQuery(asset.landingDataset ?? "", q) ||
    matchesQuery(asset.dbtPackage ?? "", q) ||
    matchesQuery(asset.catalogDescription ?? "", q) ||
    (asset.catalogTags ?? []).some((t) => matchesQuery(t, q))
  );
}

function SummaryCard({
  label,
  value,
  icon: Icon,
}: {
  label: string;
  value: number;
  icon: React.ComponentType<{ className?: string }>;
}) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <div className="flex items-center gap-2 text-slate-500 dark:text-slate-400">
        <Icon className="h-4 w-4 shrink-0" aria-hidden />
        <span className="text-xs font-medium uppercase tracking-wide">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{value}</p>
    </div>
  );
}

function AssetListRow({ asset }: { asset: WorkspaceAsset }) {
  return (
    <Link
      href={assetDetailHref(asset.id)}
      className="group flex flex-wrap items-center justify-between gap-3 rounded-lg border border-transparent px-3 py-2.5 transition hover:border-slate-200 hover:bg-slate-50 dark:hover:border-slate-700 dark:hover:bg-slate-950/50"
    >
      <div className="min-w-0 flex-1 space-y-1.5">
        <div className="flex flex-wrap items-center gap-2">
          <AssetKindBadge kind={asset.kind} />
          {asset.medallionLayer ? <MedallionLayerBadge layer={asset.medallionLayer} /> : null}
          <span className="text-sm font-medium text-slate-900 group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
            {asset.displayName}
          </span>
          {asset.transformScope === "post_replication" ? (
            <span className="rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-medium text-amber-900 dark:bg-amber-950/50">
              Post-replication
            </span>
          ) : null}
          <WarehouseStatusBadge status={asset.warehouseStatus} runObserved={asset.runObserved} />
          <AssetFreshnessBadge meta={asset.assetFreshness} />
          {asset.catalogColumnCount ? (
            <span className="rounded-full bg-slate-100 px-1.5 py-0.5 text-[9px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-400">
              {asset.catalogColumnCount} cols
            </span>
          ) : null}
        </div>
        {asset.landingQualified ? (
          <code className="block truncate font-mono text-[11px] text-slate-500">{asset.landingQualified}</code>
        ) : null}
        <AssetCatalogPreview description={asset.catalogDescription} tags={asset.catalogTags} />
      </div>
      <ChevronRight className="h-4 w-4 shrink-0 text-slate-300 group-hover:text-sky-500 dark:text-slate-600" aria-hidden />
    </Link>
  );
}

function PipelineBundleCard({ bundle, defaultOpen }: { bundle: PipelineAssetBundle; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const allAssets = [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms];
  const freshness = computePipelineFreshness(bundle.lastRun, bundle.enabled);
  const lineage = buildAssetLineageGraph(bundle);

  return (
    <article className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full flex-wrap items-start justify-between gap-3 px-5 py-4 text-left"
      >
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h2 className="font-semibold text-slate-900 dark:text-white">{bundle.pipelineName}</h2>
            {!bundle.enabled ? (
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500 dark:bg-slate-800">
                Disabled
              </span>
            ) : null}
            <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-600 dark:bg-slate-800 dark:text-slate-300">
              {syncModeLabel(bundle.syncMode)}
            </span>
            <span
              className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${freshness.badgeClass}`}
              title={freshness.detail}
            >
              {freshness.label}
            </span>
            {bundle.warehouseChecked ? (
              <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200">
                Warehouse verified
              </span>
            ) : null}
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{bundle.sourceType}</span>
            <span className="mx-1.5 text-slate-400">→</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{bundle.destinationType}</span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
            <span className="font-mono text-xs text-slate-500">{bundle.landingDataset}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            {allAssets.length} asset{allAssets.length === 1 ? "" : "s"}
            {bundle.lastRun ? (
              <>
                {" "}
                · last run{" "}
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
              </>
            ) : (
              " · no runs yet"
            )}
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {bundle.lastRun ? (
            <Link
              href={`/runs?run=${bundle.lastRun.id}`}
              onClick={(e) => e.stopPropagation()}
              className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300"
            >
              Last run
            </Link>
          ) : null}
          <Link
            href={`/builder?pipeline=${bundle.pipelineId}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300"
          >
            Pipeline
          </Link>
        </div>
      </button>

      {open ? (
        <div className="space-y-4 border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <AssetLineageGraph graph={lineage} linkNodes />
          {bundle.dbtDiff &&
          (bundle.dbtDiff.missingFromRun.length > 0 || bundle.dbtDiff.failedModels.length > 0) ? (
            <div className="rounded-lg border border-violet-200 bg-violet-50/80 px-3 py-2 text-xs dark:border-violet-900 dark:bg-violet-950/30">
              <p className="font-medium text-violet-900 dark:text-violet-100">dbt config vs last run</p>
              {bundle.dbtDiff.missingFromRun.length > 0 ? (
                <p className="mt-1 text-violet-800 dark:text-violet-200">
                  Missing on run: {bundle.dbtDiff.missingFromRun.join(", ")}
                </p>
              ) : null}
              {bundle.dbtDiff.failedModels.length > 0 ? (
                <p className="mt-1 text-red-700 dark:text-red-300">
                  Failed: {bundle.dbtDiff.failedModels.length} model(s)
                </p>
              ) : null}
            </div>
          ) : null}
          <ul className="divide-y divide-slate-100 dark:divide-slate-800">
            {allAssets.map((asset) => (
              <li key={asset.id} className="list-none">
                <AssetListRow asset={asset} />
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function AssetsPageClient() {
  const searchParams = useSearchParams();
  const { permissions } = useWorkspacePermissions();
  const canEditCatalog = permissions?.canEditCatalog ?? false;
  const pipelineFilter = searchParams.get("pipeline")?.trim() ?? "";
  const [data, setData] = useState<AssetsPageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [importingMeta, setImportingMeta] = useState(false);
  const [verifying, setVerifying] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("flat");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");
  const [health, setHealth] = useState<PipelineHealthSummary[]>([]);

  const load = useCallback(async (verifyWarehouse = false) => {
    if (verifyWarehouse) setVerifying(true);
    else setLoading(true);
    setError(null);
    try {
      const url = verifyWarehouse ? "/api/elt/assets?verifyWarehouse=1" : "/api/elt/assets";
      const res = await fetch(url);
      if (!res.ok) throw new Error("Failed to load assets");
      setData((await res.json()) as AssetsPageData);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      if (verifyWarehouse) setVerifying(false);
      else setLoading(false);
    }
  }, []);

  const importMetadata = useCallback(async () => {
    setImportingMeta(true);
    try {
      const res = await fetch("/api/elt/catalog/entries?action=import", { method: "POST" });
      if (!res.ok) throw new Error("Import failed");
      await load(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Import failed");
    } finally {
      setImportingMeta(false);
    }
  }, [load]);

  useEffect(() => {
    void load();
    void fetch("/api/elt/pipelines/health")
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (body?.health) setHealth(body.health as PipelineHealthSummary[]);
      });
  }, [load]);

  const q = query.trim().toLowerCase();

  const filteredPipelines = useMemo(() => {
    if (!data) return [];
    let list = data.pipelines;
    if (pipelineFilter) {
      list = list.filter((b) => b.pipelineId === pipelineFilter);
    }
    if (!q) return list;
    return list.filter((b) => {
      const haystack = [
        b.pipelineName,
        b.sourceType,
        b.destinationType,
        b.landingDataset,
        ...b.rawAssets.map((a) => a.name),
        ...b.transforms.map((a) => a.name),
      ]
        .join(" ")
        .toLowerCase();
      return haystack.includes(q);
    });
  }, [data, q, pipelineFilter]);

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    return data.assets.filter((a) => {
      if (pipelineFilter && a.pipelineId !== pipelineFilter) return false;
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (!q) return true;
      return assetMatches(a, q);
    });
  }, [data, q, kindFilter, pipelineFilter]);

  const transformsCtaBundle = useMemo(() => {
    if (!data) return null;
    const candidates = pipelineFilter
      ? data.pipelines.filter((b) => b.pipelineId === pipelineFilter)
      : data.pipelines;
    return candidates.find((b) => b.rawAssets.length > 0 && b.transforms.length === 0) ?? null;
  }, [data, pipelineFilter]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Database className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Data map</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Workspace assets</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Browse landing tables and transform outputs across pipelines. Medallion badges appear when a pipeline uses lake
          recipes.
        </p>
        <div className="mt-4 max-w-3xl">
          <TransformJourneyStrip compact showRecipeLink={false} />
        </div>
        <p className="mt-3 text-sm">
          <Link href="/catalog/components#recipes" className="font-medium text-violet-600 underline dark:text-violet-400">
            Add transforms with pipeline recipes
          </Link>
        </p>
      </div>

      <CatalogAccessBanner />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
          Loading assets…
        </div>
      ) : error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </div>
      ) : !data || data.summary.pipelines === 0 ? (
        <EmptyState
          icon={Layers}
          title="No assets yet"
          description="Create a pipeline to see ingested sources, landing tables, and transform outputs here."
          action={{ href: "/quick-start", label: "Quick start" }}
          secondaryAction={{ href: "/builder", label: "Open builder" }}
        />
      ) : (
        <>
          {pipelineFilter ? (
            <p className="text-sm text-slate-600 dark:text-slate-400">
              Showing assets for one pipeline.{" "}
              <Link href="/assets" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                View all
              </Link>
            </p>
          ) : null}
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Pipelines" value={data.summary.pipelines} icon={Layers} />
            <SummaryCard label="Raw tables" value={data.summary.rawAssets} icon={Table2} />
            <SummaryCard label="Transform outputs" value={data.summary.transforms} icon={GitBranch} />
            <SummaryCard label="Sources" value={data.summary.sources} icon={Database} />
          </div>

          {transformsCtaBundle ? (
            <AddTransformsCta
              pipelineId={transformsCtaBundle.pipelineId}
              pipelineName={transformsCtaBundle.pipelineName}
            />
          ) : null}

          {health.length > 0 && !pipelineFilter ? <PipelineHealthPanel health={health} /> : null}

          {data.warehouseVerification ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm dark:border-slate-800 dark:bg-slate-950/50">
              <p className="font-medium text-slate-900 dark:text-white">Warehouse verification</p>
              <p className="mt-1 text-slate-600 dark:text-slate-400">
                {data.warehouseVerification.verifiedAssets} verified · {data.warehouseVerification.missingAssets} missing
              </p>
            </div>
          ) : null}

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search assets, tags, pipelines…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {canEditCatalog ? (
                <button
                  type="button"
                  onClick={() => void importMetadata()}
                  disabled={importingMeta}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
                >
                  {importingMeta ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Import from pipelines
                </button>
              ) : null}
              <button
                type="button"
                onClick={() => void load(true)}
                disabled={verifying}
                className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                {verifying ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                Verify in warehouse
              </button>
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                {(["flat", "pipelines"] as const).map((mode) => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setView(mode)}
                    className={
                      view === mode
                        ? "rounded-md bg-sky-100 px-3 py-1 text-xs font-semibold text-sky-900 dark:bg-sky-950 dark:text-sky-100"
                        : "rounded-md px-3 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 dark:text-slate-400"
                    }
                  >
                    {mode === "flat" ? "All assets" : "By pipeline"}
                  </button>
                ))}
              </div>
              {view === "flat" ? (
                <select
                  value={kindFilter}
                  onChange={(e) => setKindFilter(e.target.value as KindFilter)}
                  className="rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-xs dark:border-slate-700 dark:bg-slate-900"
                >
                  <option value="all">All kinds</option>
                  <option value="source">Sources</option>
                  <option value="raw">Raw</option>
                  <option value="object">Objects</option>
                  <option value="transform">Transform outputs</option>
                  <option value="post_transform">Post-transforms</option>
                </select>
              ) : null}
            </div>
          </div>

          {view === "pipelines" ? (
            <div className="space-y-4">
              {filteredPipelines.length === 0 ? (
                <p className="text-sm text-slate-500">No pipelines match your search.</p>
              ) : (
                filteredPipelines.map((bundle, i) => (
                  <PipelineBundleCard key={bundle.pipelineId} bundle={bundle} defaultOpen={i === 0 && Boolean(pipelineFilter)} />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-slate-200 dark:border-slate-800">
              <ul className="divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900">
                {filteredAssets.map((asset) => (
                  <li key={asset.id}>
                    <AssetListRow asset={asset} />
                  </li>
                ))}
              </ul>
              {filteredAssets.length === 0 ? (
                <p className="px-4 py-8 text-center text-sm text-slate-500">No assets match your filters.</p>
              ) : null}
            </div>
          )}
        </>
      )}

      <RelatedLinks
        links={[
          { href: "/catalog", icon: Database, label: "Catalog", desc: "Search and browse workspace metadata" },
          { href: "/builder", icon: Layers, label: "Pipelines", desc: "Edit sync and transform configuration" },
          { href: "/runs", icon: PlayCircle, label: "Runs", desc: "Execution history and telemetry" },
        ]}
      />
    </div>
  );
}
