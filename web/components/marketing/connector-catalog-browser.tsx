"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import type { MarketingConnector, MarketingConnectorRole } from "@/lib/marketing/connector-catalog";
import { connectorSyncModeLabel } from "@/lib/elt/pipeline-tool-labels";
import { TRUST_LABELS, TRUST_STYLES } from "@/lib/elt/connector-trust";

type Props = {
  sources: MarketingConnector[];
  destinations: MarketingConnector[];
  categories: string[];
};

type Tab = "all" | "sources" | "destinations";

function ConnectorCard({ c }: { c: MarketingConnector }) {
  return (
    <Link
      href={`/connectors/${c.slug}`}
      className="group flex flex-col rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-sky-300 hover:shadow-md dark:border-slate-800 dark:bg-slate-900 dark:hover:border-sky-700"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <ConnectorIcon slug={c.slug} name={c.name} size={22} />
          <h3 className="font-semibold text-slate-900 group-hover:text-sky-700 dark:text-white dark:group-hover:text-sky-300">
            {c.name}
          </h3>
        </div>
        <span
          className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${TRUST_STYLES[c.trustTier]}`}
        >
          {TRUST_LABELS[c.trustTier]}
        </span>
      </div>
      <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
        {c.role === "source" ? "Source" : "Destination"}
        {c.tool ? ` · ${connectorSyncModeLabel(c.tool) ?? c.tool}` : ""}
        {" · "}
        {c.category}
      </p>
      <p className="mt-2 line-clamp-2 flex-1 text-sm text-slate-600 dark:text-slate-300">{c.description}</p>
    </Link>
  );
}

export function ConnectorCatalogBrowser({ sources, destinations, categories }: Props) {
  const [tab, setTab] = useState<Tab>("all");
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string>("");

  const list = useMemo(() => {
    let items: MarketingConnector[] =
      tab === "sources" ? sources : tab === "destinations" ? destinations : [...sources, ...destinations];

    const seen = new Set<string>();
    items = items.filter((c) => {
      if (seen.has(c.slug)) return false;
      seen.add(c.slug);
      return true;
    });

    const q = query.trim().toLowerCase();
    if (q) {
      items = items.filter(
        (c) =>
          c.name.toLowerCase().includes(q) ||
          c.slug.includes(q) ||
          c.description.toLowerCase().includes(q) ||
          c.category.toLowerCase().includes(q)
      );
    }
    if (category) {
      items = items.filter((c) => c.category === category);
    }
    return items;
  }, [tab, query, category, sources, destinations]);

  return (
    <div>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="inline-flex rounded-lg border border-slate-200 p-0.5 dark:border-slate-700">
          {(
            [
              ["all", "All"],
              ["sources", "Sources"],
              ["destinations", "Destinations"],
            ] as const
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => setTab(id)}
              className={`rounded-md px-3 py-1.5 text-sm font-medium transition ${
                tab === id
                  ? "bg-sky-600 text-white shadow-sm"
                  : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
        <div className="relative max-w-md flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            placeholder="Search connectors…"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button
          type="button"
          onClick={() => setCategory("")}
          className={`rounded-full px-3 py-1 text-xs font-medium ${
            !category
              ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
              : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
          }`}
        >
          All categories
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            onClick={() => setCategory(cat === category ? "" : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              category === cat
                ? "bg-slate-900 text-white dark:bg-white dark:text-slate-900"
                : "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300"
            }`}
          >
            {cat}
          </button>
        ))}
      </div>

      <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
        Showing {list.length} connector{list.length === 1 ? "" : "s"}
      </p>

      <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((c) => (
          <ConnectorCard key={`${c.role}-${c.slug}`} c={c} />
        ))}
      </div>

      {list.length === 0 ? (
        <p className="mt-8 text-center text-sm text-slate-500">No connectors match your filters.</p>
      ) : null}
    </div>
  );
}

export function RoleBadge({ role }: { role: MarketingConnectorRole }) {
  return (
    <span className="rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700 dark:bg-slate-800 dark:text-slate-300">
      {role === "source" ? "Source" : "Destination"}
    </span>
  );
}
