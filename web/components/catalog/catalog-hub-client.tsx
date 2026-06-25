"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { Sparkles, ArrowRight,
  BookOpen,
  Database,
  GitBranch,
  LayoutGrid,
  Loader2,
  Route,
  Search,
  Shield,
  Table2,
  Workflow,
} from "lucide-react";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";
import { PipelineHealthPanel } from "@/components/catalog/pipeline-health-panel";
import { AssetCatalogAiPanel } from "@/components/assets/asset-catalog-ai-panel";
import { RelatedLinks } from "@/components/ui/related-links";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import { assetDetailHref } from "@/lib/elt/asset-path";
import type { PipelineHealthSummary } from "@/lib/elt/pipeline-health";
import { AppPage } from "@/components/layout/app-page";

type Overview = {
  summary: {
    pipelines: number;
    connections: number;
    catalogEntries: number;
    assets: { rawAssets: number; transforms: number };
  };
  dbtProjects: { pipelineId: string; pipelineName: string; modelCount: number }[];
  connectorsAvailable: number;
};

const CARDS = [
  { href: "/assets", label: "Assets", icon: Table2, desc: "Landing tables, transform outputs, and lineage on any warehouse" },
  { href: "/catalog/dbt", label: "Git SQL projects", icon: GitBranch, desc: "Recommended — dbt models, tests, docs" },
  { href: "/catalog/transform-hub", label: "dbt package hub", icon: Workflow, desc: "Connector staging packages" },
  { href: "/catalog/components", label: "Transforms", icon: Sparkles, desc: "Canvas recipes — prototype before dbt" },
  { href: "/catalog/products", label: "Data products", icon: Database, desc: "Curated governed asset bundles" },
  { href: "/catalog/contracts", label: "Data contracts", icon: Shield, desc: "Schema and freshness SLAs" },
  { href: "/catalog/connectors", label: "Connectors", icon: LayoutGrid, desc: "What your workspace uses + full registry" },
  { href: "/sources", label: "Source registry", icon: BookOpen, desc: "Browse 111+ dlt-verified source connectors" },
  { href: "/catalog/scenarios", label: "Scenarios", icon: Route, desc: "Ingest recipes — add transforms after deploy" },
] as const;

type SearchHit = {
  assetKey: string;
  kind: string;
  displayName: string;
  description?: string;
  tags: string[];
  pipelineId?: string;
  pipelineName?: string;
  source: "catalog_entry" | "asset";
  score?: number;
  qualityBadges?: string[];
  relatedAssetKeys?: string[];
};

type RecentView = { assetKey: string; viewedAt: string };

type Collection = {
  id: string;
  slug: string;
  name: string;
  description?: string | null;
  featured: boolean;
  items: { assetKey: string }[];
};

export function CatalogHubClient() {
  const { permissions } = useWorkspacePermissions();
  const canEditCatalog = permissions?.canEditCatalog ?? false;
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [recentViews, setRecentViews] = useState<RecentView[]>([]);
  const [collections, setCollections] = useState<Collection[]>([]);
  const [health, setHealth] = useState<PipelineHealthSummary[]>([]);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/elt/catalog/overview");
        if (res.ok) setData((await res.json()) as Overview);
      } finally {
        setLoading(false);
      }
    })();
    void (async () => {
      const [viewsRes, collRes, healthRes] = await Promise.all([
        fetch("/api/elt/catalog/views"),
        fetch("/api/elt/catalog/collections"),
        fetch("/api/elt/pipelines/health"),
      ]);
      if (viewsRes.ok) {
        const body = (await viewsRes.json()) as { views: RecentView[] };
        setRecentViews(body.views ?? []);
      }
      if (collRes.ok) {
        const body = (await collRes.json()) as { collections: Collection[] };
        setCollections(body.collections ?? []);
      }
      if (healthRes.ok) {
        const body = (await healthRes.json()) as { health: PipelineHealthSummary[] };
        setHealth(body.health ?? []);
      }
    })();
  }, []);

  useEffect(() => {
    const q = searchQ.trim();
    if (q.length < 2) {
      setSearchHits([]);
      return;
    }
    const handle = setTimeout(() => {
      void (async () => {
        setSearching(true);
        try {
          const res = await fetch(`/api/elt/catalog/search?q=${encodeURIComponent(q)}`);
          if (res.ok) {
            const body = (await res.json()) as { hits: SearchHit[] };
            setSearchHits(body.hits ?? []);
          }
        } finally {
          setSearching(false);
        }
      })();
    }, 250);
    return () => clearTimeout(handle);
  }, [searchQ]);

  return (
    <AppPage width="default">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <BookOpen className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Library</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Recipes &amp; reference</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Scenarios, transform recipes, dbt projects, connectors, data products, and contracts — starting points and
          reference material separate from your live{" "}
          <Link href="/assets" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            asset inventory
          </Link>
          .
        </p>
        <div className="mt-4 max-w-3xl">
          <TransformJourneyStrip compact showRecipeLink={false} />
        </div>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
        <label className="flex items-center gap-2 text-sm font-medium text-slate-700 dark:text-slate-200">
          <Search className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
          Search catalog
        </label>
        <input
          type="search"
          value={searchQ}
          onChange={(e) => setSearchQ(e.target.value)}
          placeholder="Tags, descriptions, column names, asset names…"
          className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-sky-500 dark:border-slate-700 dark:bg-slate-800 dark:text-white"
        />
        {searchQ.trim().length >= 2 ? (
          <div className="mt-3">
            {searching ? (
              <p className="flex items-center gap-2 text-xs text-slate-500">
                <Loader2 className="h-3.5 w-3.5 animate-spin" /> Searching…
              </p>
            ) : searchHits.length === 0 ? (
              <p className="text-xs text-slate-500">No matches for &ldquo;{searchQ.trim()}&rdquo;</p>
            ) : (
              <ul className="divide-y divide-slate-100 dark:divide-slate-800">
                {searchHits.map((hit) => (
                  <li key={hit.assetKey} className="py-2">
                    <Link
                      href={assetDetailHref(hit.assetKey)}
                      className="font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      {hit.displayName}
                    </Link>
                    <p className="text-xs text-slate-500">
                      {hit.kind}
                      {hit.pipelineName ? ` · ${hit.pipelineName}` : ""}
                      {hit.tags.length ? ` · ${hit.tags.join(", ")}` : ""}
                    </p>
                    {hit.qualityBadges?.length ? (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {hit.qualityBadges.map((b) => (
                          <span
                            key={b}
                            className="rounded-full bg-sky-50 px-1.5 py-0.5 text-[10px] font-medium text-sky-700 dark:bg-sky-950/40 dark:text-sky-300"
                          >
                            {b}
                          </span>
                        ))}
                      </div>
                    ) : null}
                    {hit.description ? (
                      <p className="mt-0.5 line-clamp-2 text-xs text-slate-600 dark:text-slate-400">
                        {hit.description}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
          </div>
        ) : null}
      </section>

      <AssetCatalogAiPanel variant="catalog" canEditCatalog={canEditCatalog} />

      {recentViews.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Recently viewed</h2>
          <ul className="mt-2 flex flex-wrap gap-2">
            {recentViews.map((v) => (
              <li key={v.assetKey}>
                <Link
                  href={assetDetailHref(v.assetKey)}
                  className="inline-flex rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  {v.assetKey.split(":").pop() ?? v.assetKey}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {collections.length > 0 ? (
        <section className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Data products</h2>
            <Link href="/catalog/products" className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400">
              View all
            </Link>
          </div>
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {collections.filter((c) => c.featured).slice(0, 4).map((c) => (
              <li key={c.id} className="rounded-lg border border-slate-100 p-3 dark:border-slate-800">
                <p className="font-medium text-slate-900 dark:text-white">{c.name}</p>
                {c.description ? <p className="mt-1 line-clamp-2 text-xs text-slate-500">{c.description}</p> : null}
                <p className="mt-2 text-xs text-slate-400">{c.items.length} assets</p>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {health.length > 0 ? <PipelineHealthPanel health={health} /> : null}

      <CatalogAccessBanner />

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          {[
            { label: "Pipelines", value: data.summary.pipelines },
            { label: "Catalog entries", value: data.summary.catalogEntries },
            { label: "Transform outputs", value: data.summary.assets.transforms },
            { label: "Git SQL projects", value: data.dbtProjects.length },
            { label: "Connectors", value: data.connectorsAvailable },
          ].map((s) => (
            <div
              key={s.label}
              className="rounded-xl border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs font-medium uppercase tracking-wide text-slate-500">{s.label}</p>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            </div>
          ))}
        </div>
      ) : null}

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/catalog/components"
          className="group col-span-full rounded-xl border-2 border-violet-200 bg-gradient-to-br from-violet-50 to-white p-5 transition hover:border-violet-400 dark:border-violet-800 dark:from-violet-950/40 dark:to-slate-900 dark:hover:border-violet-600"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-start gap-3">
              <Sparkles className="h-8 w-8 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
              <div>
                <h2 className="font-semibold text-slate-900 dark:text-white">Transforms</h2>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                  Pipeline recipes (medallion, source→mart, entity 360), warehouse SQL components, and custom compile
                  packages — everything after ingest on one lake.
                </p>
                <p className="mt-2 text-xs font-medium text-violet-700 dark:text-violet-300">
                  Recipes to prototype · dbt for production · dataframe legacy
                </p>
              </div>
            </div>
            <ArrowRight className="h-5 w-5 shrink-0 text-violet-400 transition group-hover:translate-x-0.5 group-hover:text-violet-600" />
          </div>
        </Link>
        {CARDS.filter((c) => c.href !== "/catalog/components").map((card) => (
          <Link
            key={card.href}
            href={card.href}
            className="group rounded-xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
          >
            <div className="flex items-start justify-between gap-3">
              <card.icon className="h-8 w-8 text-sky-600 dark:text-sky-400" aria-hidden />
              <ArrowRight className="h-4 w-4 text-slate-400 transition group-hover:text-sky-600" />
            </div>
            <h2 className="mt-3 font-semibold text-slate-900 dark:text-white">{card.label}</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{card.desc}</p>
          </Link>
        ))}
      </div>

      <RelatedLinks
        links={[
          { href: "/catalog/components", icon: Sparkles, label: "Transforms", desc: "Recipes and warehouse SQL" },
          { href: "/sources", icon: Database, label: "Source registry", desc: "Browse connector catalog" },
          { href: "/builder/canvas", icon: LayoutGrid, label: "Canvas", desc: "Visual ingest + transform graph" },
        ]}
      />
    </AppPage>
  );
}
