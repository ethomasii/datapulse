import type { Metadata } from "next";
import Link from "next/link";
import { DbtHubPageClient } from "@/components/dbt/dbt-hub-page-client";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "dbt & transformations",
  description:
    "Run dbt on your warehouse after every eltPulse sync — package picker, Git scaffold, sync→transform run phases, and connector staging models.",
  path: "/dbt",
  keywords: ["dbt", "ELT", "transformations", "data warehouse", "Fivetran dbt", "staging models", "lineage"],
});

export default function DbtMarketingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Transform hub
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        dbt on your warehouse — your project, our orchestration
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        eltPulse syncs data from your connectors, loads it into Snowflake, BigQuery, Postgres, or DuckDB, then runs your
        dbt project in the same pipeline run. Pick a staging package, scaffold to Git, and watch{" "}
        <strong className="font-medium text-slate-800 dark:text-slate-100">sync → load → transform</strong> in Runs. You
        keep models in your repo — we are not dbt Cloud.
      </p>

      <DbtHubPageClient />

      <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pair with connectors & scenarios</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Start from a{" "}
          <Link href="/scenarios" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            pipeline scenario
          </Link>
          , enable dbt in the builder, and export everything to Git.
        </p>
        <Link
          href="/compare"
          className="mt-4 inline-flex text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          Compare to Fivetran + dbt →
        </Link>
      </section>
    </div>
  );
}
