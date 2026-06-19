"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { ArrowRight, Route, Search } from "lucide-react";
import { PIPELINE_SCENARIOS, SCENARIO_INDUSTRY_LABELS, lakeStarterIdForScenario } from "@/lib/marketing/pipeline-scenarios";
import { connectorDisplayName } from "@/lib/marketing/connector-display-names";

export function CatalogScenariosClient() {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return PIPELINE_SCENARIOS;
    return PIPELINE_SCENARIOS.filter(
      (s) =>
        s.title.toLowerCase().includes(q) ||
        s.description.toLowerCase().includes(q) ||
        s.tags.some((t) => t.includes(q))
    );
  }, [query]);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <Link href="/catalog" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Pipeline scenarios</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Curated source → destination recipes. Deploy into your workspace — then open canvas with a matching lake
          recipe to add transforms.
        </p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search scenarios…"
          className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
        />
      </div>

      <ul className="grid gap-4 sm:grid-cols-2">
        {filtered.map((s) => (
          <li
            key={s.id}
            className="flex flex-col rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <Route className="h-3.5 w-3.5" />
              {SCENARIO_INDUSTRY_LABELS[s.industry]} · {s.persona}
            </div>
            <h2 className="mt-2 font-semibold text-slate-900 dark:text-white">{s.title}</h2>
            <p className="mt-2 flex-1 text-sm text-slate-600 dark:text-slate-400">{s.description}</p>
            <p className="mt-2 text-xs text-slate-500">
              {connectorDisplayName(s.sourceSlug) ?? s.sourceSlug} →{" "}
              {connectorDisplayName(s.destinationSlug) ?? s.destinationSlug}
            </p>
            <p className="mt-2 text-[10px] font-medium text-violet-600 dark:text-violet-400">
              After deploy → {lakeStarterIdForScenario(s).replace(/_/g, " ")} on canvas
            </p>
            <Link
              href={`/quick-start?source=${encodeURIComponent(s.sourceSlug)}&destination=${encodeURIComponent(s.destinationSlug)}&scenario=${encodeURIComponent(s.id)}`}
              className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Deploy scenario <ArrowRight className="h-4 w-4" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
