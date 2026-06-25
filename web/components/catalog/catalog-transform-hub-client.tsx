"use client";

import Link from "next/link";
import { GitBranch, Layers, Sparkles } from "lucide-react";
import { DbtHubPageClient } from "@/components/dbt/dbt-hub-page-client";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import { RelatedLinks } from "@/components/ui/related-links";

export function CatalogTransformHubClient() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <Link href="/catalog/dbt" className="text-sm font-medium text-indigo-600 hover:underline dark:text-indigo-400">
          ← Git SQL projects
        </Link>
        <div className="mt-2 inline-flex items-center gap-2 text-indigo-600 dark:text-indigo-400">
          <GitBranch className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Recommended</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">dbt package hub</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Connector-aligned <strong className="font-medium">dbt staging packages</strong> — the best path for production
          transforms (tests, docs, git). Prototype faster with{" "}
          <Link href="/catalog/components#recipes" className="font-medium text-violet-600 underline dark:text-violet-400">
            canvas recipes
          </Link>{" "}
          first if you prefer a visual start.
        </p>
      </div>

      <TransformJourneyStrip compact />

      <div className="rounded-xl border border-indigo-200 bg-indigo-50/70 p-5 dark:border-indigo-900 dark:bg-indigo-950/30">
        <h2 className="text-sm font-semibold text-indigo-900 dark:text-indigo-100">Why dbt here</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-indigo-900/90 dark:text-indigo-100/90">
          <li>Versioned models in git with tests and documentation.</li>
          <li>Pick a connector package below → <strong>Create pipeline with package</strong>.</li>
          <li>Runs after sync in the same pipeline — or manage at{" "}
            <Link href="/catalog/dbt" className="font-medium underline">
              Git SQL projects
            </Link>
            .
          </li>
        </ol>
      </div>

      <DbtHubPageClient variant="app" />

      <RelatedLinks
        links={[
          { href: "/catalog/dbt", icon: GitBranch, label: "Git SQL projects", desc: "Recommended production path" },
          { href: "/catalog/components#recipes", icon: Sparkles, label: "Canvas recipes", desc: "Prototype before dbt" },
          { href: "/builder?view=canvas", icon: Layers, label: "Canvas designer", desc: "Visual ingest + transform graph" },
        ]}
      />
    </div>
  );
}
