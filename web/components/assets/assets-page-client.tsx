"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Database,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
  Search,
  Table2,
} from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";
import { RelatedLinks } from "@/components/ui/related-links";
import { syncModeLabel } from "@/lib/elt/pipeline-tool-labels";
import type {
  PipelineAssetBundle,
  WorkspaceAsset,
  WorkspaceAssetKind,
  WorkspaceAssetsResponse,
} from "@/lib/elt/pipeline-assets";

type ViewMode = "pipelines" | "flat";
type KindFilter = "all" | WorkspaceAssetKind;

const KIND_META: Record<
  WorkspaceAssetKind,
  { label: string; badge: string }
> = {
  source: {
    label: "Source",
    badge: "bg-sky-100 text-sky-800 dark:bg-sky-950/50 dark:text-sky-200",
  },
  raw: {
    label: "Raw",
    badge: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200",
  },
  transform: {
    label: "dbt model",
    badge: "bg-violet-100 text-violet-800 dark:bg-violet-950/50 dark:text-violet-200",
  },
  post_transform: {
    label: "Post-transform",
    badge: "bg-amber-100 text-amber-900 dark:bg-amber-950/50 dark:text-amber-200",
  },
};

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
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
    matchesQuery(asset.dbtPackage ?? "", q)
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

function AssetKindBadge({ kind }: { kind: WorkspaceAssetKind }) {
  const meta = KIND_META[kind];
  return (
    <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${meta.badge}`}>
      {meta.label}
    </span>
  );
}

function PipelineBundleCard({ bundle, defaultOpen }: { bundle: PipelineAssetBundle; defaultOpen?: boolean }) {
  const [open, setOpen] = useState(defaultOpen ?? false);
  const allAssets = [bundle.source, ...bundle.rawAssets, ...bundle.transforms, ...bundle.postTransforms];

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
          </div>
          <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
            <span className="font-medium text-slate-800 dark:text-slate-200">{bundle.sourceType}</span>
            <span className="mx-1.5 text-slate-400">→</span>
            <span className="font-medium text-slate-800 dark:text-slate-200">{bundle.destinationType}</span>
            <span className="mx-2 text-slate-300 dark:text-slate-600">·</span>
            <span className="font-mono text-xs text-slate-500">{bundle.landingDataset}</span>
          </p>
          <p className="mt-1 text-xs text-slate-500 dark:text-slate-500">
            {bundle.rawAssets.length} raw
            {bundle.transforms.length ? ` · ${bundle.transforms.length} dbt` : ""}
            {bundle.postTransforms.length ? ` · ${bundle.postTransforms.length} post-transform` : ""}
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
          <Link
            href={`/builder?pipeline=${bundle.pipelineId}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300"
          >
            Pipeline
          </Link>
          <Link
            href={`/runs?pipeline=${bundle.pipelineId}`}
            onClick={(e) => e.stopPropagation()}
            className="rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-600 hover:border-sky-300 hover:text-sky-700 dark:border-slate-700 dark:text-slate-300"
          >
            Runs
          </Link>
        </div>
      </button>

      {open ? (
        <div className="border-t border-slate-100 px-5 py-4 dark:border-slate-800">
          <ul className="space-y-2">
            {allAssets.map((asset) => (
              <li
                key={asset.id}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-slate-50 px-3 py-2 dark:bg-slate-950/50"
              >
                <div className="flex min-w-0 flex-wrap items-center gap-2">
                  <AssetKindBadge kind={asset.kind} />
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{asset.displayName}</span>
                  {asset.landingQualified ? (
                    <code className="truncate font-mono text-[11px] text-slate-500">{asset.landingQualified}</code>
                  ) : null}
                </div>
                {asset.dbtPackage ? (
                  <span className="text-[11px] text-slate-500">{asset.dbtPackage.replace(/^dlt-hub\//, "")}</span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </article>
  );
}

export function AssetsPageClient() {
  const [data, setData] = useState<WorkspaceAssetsResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<ViewMode>("pipelines");
  const [kindFilter, setKindFilter] = useState<KindFilter>("all");

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/elt/assets");
      if (!res.ok) throw new Error("Failed to load assets");
      setData((await res.json()) as WorkspaceAssetsResponse);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const q = query.trim().toLowerCase();

  const filteredPipelines = useMemo(() => {
    if (!data) return [];
    if (!q) return data.pipelines;
    return data.pipelines.filter((b) => {
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
  }, [data, q]);

  const filteredAssets = useMemo(() => {
    if (!data) return [];
    return data.assets.filter((a) => {
      if (kindFilter !== "all" && a.kind !== kindFilter) return false;
      if (!q) return true;
      return assetMatches(a, q);
    });
  }, [data, q, kindFilter]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Database className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Data map</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Workspace assets</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          A config-derived inventory of what your pipelines ingest, where raw data lands, and which dbt models transform
          it. eltPulse figures out the sync engine — you see sources, tables, and transforms in one place.
        </p>
      </div>

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
          description="Create a pipeline to see ingested sources, landing tables, and dbt transforms here."
          action={{ href: "/quick-start", label: "Quick start" }}
          secondaryAction={{ href: "/builder", label: "Open builder" }}
        />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <SummaryCard label="Pipelines" value={data.summary.pipelines} icon={Layers} />
            <SummaryCard label="Raw tables" value={data.summary.rawAssets} icon={Table2} />
            <SummaryCard label="dbt models" value={data.summary.transforms} icon={GitBranch} />
            <SummaryCard label="Sources" value={data.summary.sources} icon={Database} />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div className="relative max-w-md flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" aria-hidden />
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search pipelines, tables, models…"
                className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
                {(["pipelines", "flat"] as const).map((mode) => (
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
                    {mode === "pipelines" ? "By pipeline" : "All assets"}
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
                  <option value="transform">dbt models</option>
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
                  <PipelineBundleCard key={bundle.pipelineId} bundle={bundle} defaultOpen={i === 0} />
                ))
              )}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
                  <tr>
                    <th className="px-4 py-2 font-medium">Asset</th>
                    <th className="px-4 py-2 font-medium">Kind</th>
                    <th className="px-4 py-2 font-medium">Landing</th>
                    <th className="px-4 py-2 font-medium">Pipeline</th>
                    <th className="px-4 py-2 font-medium" />
                  </tr>
                </thead>
                <tbody>
                  {filteredAssets.map((asset) => (
                    <tr key={asset.id} className="border-b border-slate-100 dark:border-slate-800/80">
                      <td className="px-4 py-2.5 font-medium text-slate-900 dark:text-white">{asset.displayName}</td>
                      <td className="px-4 py-2.5">
                        <AssetKindBadge kind={asset.kind} />
                      </td>
                      <td className="px-4 py-2.5 font-mono text-xs text-slate-500">
                        {asset.landingQualified ?? asset.landingDataset ?? "—"}
                      </td>
                      <td className="px-4 py-2.5 text-slate-600 dark:text-slate-400">{asset.pipelineName}</td>
                      <td className="px-4 py-2.5 text-right">
                        <Link
                          href={`/builder?pipeline=${asset.pipelineId}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                        >
                          Open <ArrowRight className="h-3 w-3" />
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredAssets.length === 0 ? (
                <p className="px-4 py-6 text-sm text-slate-500">No assets match your filters.</p>
              ) : null}
            </div>
          )}
        </>
      )}

      <RelatedLinks
        links={[
          { href: "/builder", icon: Layers, label: "Pipelines", desc: "Edit sync and transform configuration" },
          { href: "/dbt", icon: GitBranch, label: "dbt transforms", desc: "Staging packages and scaffold to Git" },
          { href: "/runs", icon: PlayCircle, label: "Runs", desc: "Execution history and telemetry" },
        ]}
      />
    </div>
  );
}
