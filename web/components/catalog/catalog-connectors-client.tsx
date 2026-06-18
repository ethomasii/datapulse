"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { ArrowRight, ExternalLink, LayoutGrid, Loader2, Search } from "lucide-react";
import { ALL_CONNECTORS } from "@/lib/elt/connectors-registry";
import { connectorDisplayName } from "@/lib/marketing/connector-display-names";

type Overview = {
  connectorUsage: { sources: Record<string, number>; destinations: Record<string, number> };
  connectorsAvailable: number;
};

export function CatalogConnectorsClient() {
  const [data, setData] = useState<Overview | null>(null);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

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

  const inUse = useMemo(() => {
    if (!data) return [];
    const keys = new Set([
      ...Object.keys(data.connectorUsage.sources),
      ...Object.keys(data.connectorUsage.destinations),
    ]);
    return Array.from(keys).map((slug) => ({
      slug,
      label: connectorDisplayName(slug) ?? slug,
      asSource: data.connectorUsage.sources[slug] ?? 0,
      asDest: data.connectorUsage.destinations[slug] ?? 0,
    }));
  }, [data]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    const registry = ALL_CONNECTORS.filter(
      (c) =>
        !q ||
        c.slug.includes(q) ||
        (c.label ?? c.slug).toLowerCase().includes(q) ||
        c.category.toLowerCase().includes(q)
    );
    return registry;
  }, [query]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <Link href="/catalog" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Connectors</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Connectors in your workspace pipelines plus the full eltPulse registry. Start a pipeline from any connector.
        </p>
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : (
        <>
          {inUse.length > 0 ? (
            <section>
              <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">In your workspace</h2>
              <ul className="mt-3 grid gap-2 sm:grid-cols-2">
                {inUse.map((c) => (
                  <li
                    key={c.slug}
                    className="flex items-center justify-between rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900"
                  >
                    <div>
                      <p className="font-medium text-slate-900 dark:text-white">{c.label}</p>
                      <p className="text-xs text-slate-500">
                        {c.asSource ? `${c.asSource} pipeline(s) as source` : ""}
                        {c.asSource && c.asDest ? " · " : ""}
                        {c.asDest ? `${c.asDest} as destination` : ""}
                      </p>
                    </div>
                    <Link
                      href={`/quick-start?source=${encodeURIComponent(c.slug)}`}
                      className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Use
                    </Link>
                  </li>
                ))}
              </ul>
            </section>
          ) : (
            <p className="text-sm text-slate-500">No pipelines yet — browse the registry below or open Quick start.</p>
          )}
        </>
      )}

      <section>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold uppercase tracking-wide text-slate-500">
            <LayoutGrid className="h-4 w-4" /> Full registry ({ALL_CONNECTORS.length})
          </h2>
          <div className="relative max-w-sm flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search connectors…"
              className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
            />
          </div>
        </div>
        <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.slice(0, 60).map((c) => (
            <li
              key={c.slug}
              className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2.5 dark:border-slate-800 dark:bg-slate-950/50"
            >
              <p className="font-medium text-slate-900 dark:text-white">{c.label ?? c.slug}</p>
              <p className="text-[11px] text-slate-500">{c.category}</p>
              <div className="mt-2 flex flex-wrap gap-2">
                <Link
                  href={`/quick-start?source=${encodeURIComponent(c.slug)}`}
                  className="inline-flex items-center gap-1 text-[11px] font-medium text-sky-600 dark:text-sky-400"
                >
                  Quick start <ArrowRight className="h-3 w-3" />
                </Link>
                <a
                  href={`/connectors/${c.slug}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-[11px] text-slate-500 hover:text-slate-700"
                >
                  Docs <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}
