"use client";

import Link from "next/link";
import { GitBranch, Layers } from "lucide-react";
import { DbtHubPageClient } from "@/components/dbt/dbt-hub-page-client";
import { RelatedLinks } from "@/components/ui/related-links";

export function CatalogTransformHubClient() {
  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <Link href="/catalog/dbt" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← My dbt projects
        </Link>
        <div className="mt-2 inline-flex items-center gap-2 text-violet-600 dark:text-violet-400">
          <GitBranch className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Transform hub</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">dbt staging packages</h1>
        <p className="mt-3 max-w-3xl text-slate-600 dark:text-slate-300">
          Pick a connector-aligned dbt package, create a pipeline with dbt enabled, and your project appears under{" "}
          <Link href="/catalog/dbt" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            My dbt projects
          </Link>
          . dbt runs after each sync in the same pipeline run — sync → load → transform.
        </p>
      </div>

      <div className="rounded-xl border border-sky-200 bg-sky-50/70 p-5 dark:border-sky-900 dark:bg-sky-950/30">
        <h2 className="text-sm font-semibold text-sky-900 dark:text-sky-100">Three steps to your first dbt project</h2>
        <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-sky-900/90 dark:text-sky-100/90">
          <li>
            Browse packages below and click <strong>Create pipeline with package</strong> (or open the{" "}
            <Link href="/builder?dbt=1" className="font-medium underline">
              pipeline builder
            </Link>
            ).
          </li>
          <li>
            In the builder, open <strong>Post-load transform</strong>, choose <strong>dbt</strong>, pick a package path,
            and save the pipeline.
          </li>
          <li>
            Run the pipeline — check{" "}
            <Link href="/catalog/dbt" className="font-medium underline">
              My dbt projects
            </Link>{" "}
            and{" "}
            <Link href="/runs" className="font-medium underline">
              Runs
            </Link>{" "}
            for transform phases and model results.
          </li>
        </ol>
      </div>

      <DbtHubPageClient variant="app" />

      <RelatedLinks
        links={[
          { href: "/catalog/dbt", icon: GitBranch, label: "My dbt projects", desc: "Projects attached to pipelines" },
          { href: "/builder?dbt=1", icon: Layers, label: "Pipeline builder", desc: "Create or edit pipelines with dbt" },
          { href: "/docs/dbt", icon: GitBranch, label: "dbt docs", desc: "Configuration reference" },
        ]}
      />
    </div>
  );
}
