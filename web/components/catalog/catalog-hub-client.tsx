"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Database,
  GitBranch,
  LayoutGrid,
  Loader2,
  Route,
  Search,
  Table2,
  Workflow,
} from "lucide-react";
import { RelatedLinks } from "@/components/ui/related-links";
import { assetDetailHref } from "@/lib/elt/asset-path";

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
  { href: "/assets", label: "Assets", icon: Table2, desc: "Tables, objects, and dbt models across pipelines" },
  { href: "/catalog/connectors", label: "Connectors", icon: LayoutGrid, desc: "What your workspace uses + full registry" },
  { href: "/catalog/scenarios", label: "Scenarios", icon: Route, desc: "Starter recipes you can deploy" },
  { href: "/catalog/dbt", label: "dbt projects", icon: GitBranch, desc: "Projects, models, runs — Snowflake-style hub" },
  { href: "/catalog/transform-hub", label: "Transform hub", icon: Workflow, desc: "Browse dbt staging packages by connector" },
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
};

export function CatalogHubClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);
  const [searchQ, setSearchQ] = useState("");
  const [searchHits, setSearchHits] = useState<SearchHit[]>([]);
  const [searching, setSearching] = useState(false);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/elt/catalog/overview");
        if (res.ok) setData((await res.json()) as Overview);
      } finally {
        setLoading(false);
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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <div className="inline-flex items-center gap-2 text-sky-600 dark:text-sky-400">
          <Database className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Catalog</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Workspace catalog</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Your data inventory, connector usage, pipeline scenarios, and dbt projects — all in the app, not marketing pages.
          Import metadata from pipelines on the Assets page, then edit descriptions and tags per asset.
        </p>
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
          placeholder="Tags, descriptions, asset names…"
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

      {loading ? (
        <div className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading catalog…
        </div>
      ) : data ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[
            { label: "Pipelines", value: data.summary.pipelines },
            { label: "Catalog entries", value: data.summary.catalogEntries },
            { label: "dbt projects", value: data.dbtProjects.length },
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
        {CARDS.map((card) => (
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
          { href: "/sources", icon: Database, label: "Source registry", desc: "Browse dlt-hub connector catalog" },
          { href: "/builder", icon: LayoutGrid, label: "Pipelines", desc: "Edit sync and transform config" },
        ]}
      />
    </div>
  );
}
