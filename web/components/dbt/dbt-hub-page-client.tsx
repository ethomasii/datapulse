"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { SignedIn, SignedOut } from "@clerk/nextjs";
import {
  Activity,
  ArrowRight,
  CheckCircle2,
  Circle,
  GitBranch,
  Layers,
  LineChart,
  Search,
  Workflow,
} from "lucide-react";
import type { DbtHubPackage } from "@/lib/elt/dbt-hub-packages";

const V2_ROADMAP = [
  { id: "packages", label: "Connector staging package picker", done: true },
  { id: "scaffold", label: "Scaffold dbt project to Git", done: true },
  { id: "phases", label: "Load → dbt run phases in telemetry", done: true },
  { id: "worker", label: "dbt on managed workers (GHA)", done: true },
  { id: "manifest", label: "Manifest + model list on run detail", done: false },
  { id: "lineage", label: "Canvas lineage (source → staging → marts)", done: false },
  { id: "hooks", label: "Webhooks with dbt test failures", done: false },
  { id: "sling", label: "Post-Sling dbt job type", done: false },
] as const;

export function DbtHubPageClient() {
  const [packages, setPackages] = useState<DbtHubPackage[]>([]);
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await fetch("/api/elt/dbt-packages");
        if (res.ok) {
          const data = (await res.json()) as { packages: DbtHubPackage[] };
          setPackages(data.packages ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return packages;
    return packages.filter(
      (p) =>
        p.sourceKey.includes(q) ||
        p.package.includes(q) ||
        p.description.toLowerCase().includes(q) ||
        p.models.some((m) => m.includes(q))
    );
  }, [packages, query]);

  return (
    <>
      <div className="mt-8 flex flex-wrap gap-3">
        <SignedIn>
          <Link
            href="/builder"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Open builder
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/runs"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            View runs
          </Link>
        </SignedIn>
        <SignedOut>
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
        </SignedOut>
        <Link
          href="/docs/dbt"
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          Technical docs
        </Link>
      </div>

      <section className="mt-16 grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="flex items-center gap-2 text-lg font-bold text-slate-900 dark:text-white">
            <Workflow className="h-5 w-5 text-sky-600" />
            How it works
          </h2>
          <ol className="mt-4 space-y-4 text-sm text-slate-600 dark:text-slate-300">
            <li className="flex gap-3">
              <Layers className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" />
              <span>
                <strong className="text-slate-900 dark:text-white">Sync</strong> — eltPulse extracts from your connector
                (API, files, or database replication) into the warehouse you chose.
              </span>
            </li>
            <li className="flex gap-3">
              <GitBranch className="mt-0.5 h-4 w-4 shrink-0 text-violet-600" />
              <span>
                <strong className="text-slate-900 dark:text-white">Load</strong> — raw tables land in a dataset or schema
                ready for modeling.
              </span>
            </li>
            <li className="flex gap-3">
              <LineChart className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong className="text-slate-900 dark:text-white">Transform</strong> — your dbt project runs in the same
                pipeline run, using the same destination credentials.
              </span>
            </li>
            <li className="flex gap-3">
              <Activity className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
              <span>
                <strong className="text-slate-900 dark:text-white">Observe</strong> — runs show sync, load, and dbt
                phases separately in telemetry.
              </span>
            </li>
          </ol>
        </div>

        <div className="rounded-2xl border border-violet-200 bg-violet-50/50 p-6 dark:border-violet-900 dark:bg-violet-950/30">
          <h2 className="text-lg font-bold text-slate-900 dark:text-white">dbt v2 roadmap</h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Building toward Fivetran+dbt-class handoffs without vendor lock-in.
          </p>
          <ul className="mt-4 space-y-2">
            {V2_ROADMAP.map((item) => (
              <li key={item.id} className="flex items-start gap-2 text-sm">
                {item.done ? (
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
                ) : (
                  <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                )}
                <span className={item.done ? "text-slate-800 dark:text-slate-200" : "text-slate-500"}>
                  {item.label}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Staging packages by connector</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Curated dbt Hub packages that match eltPulse connectors — pick one in the builder or scaffold straight to Git.
        </p>
        <div className="relative mt-4 max-w-md">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search packages or models…"
            className="w-full rounded-lg border border-slate-200 py-2 pl-9 pr-3 text-sm dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
        {loading ? (
          <p className="mt-6 text-sm text-slate-500">Loading packages…</p>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2">
            {filtered.map((pkg) => (
              <article
                key={pkg.sourceKey}
                className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900"
              >
                <div className="flex items-start justify-between gap-2">
                  <h3 className="font-semibold capitalize text-slate-900 dark:text-white">{pkg.sourceKey}</h3>
                  <Link
                    href={`/connectors/${pkg.sourceSlugs[0]}`}
                    className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Connector
                  </Link>
                </div>
                <p className="mt-1 font-mono text-xs text-sky-700 dark:text-sky-300">{pkg.package}</p>
                <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{pkg.description}</p>
                <p className="mt-2 font-mono text-[10px] text-slate-500">{pkg.models.join(" · ")}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  <a
                    href={pkg.docsUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs font-medium text-slate-600 hover:underline dark:text-slate-400"
                  >
                    dbt Hub →
                  </a>
                  <SignedIn>
                    <Link
                      href={`/builder?source=${encodeURIComponent(pkg.sourceSlugs[0])}&dbt=1`}
                      className="text-xs font-semibold text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Enable in builder →
                    </Link>
                  </SignedIn>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
