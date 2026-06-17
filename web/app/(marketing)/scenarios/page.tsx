import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ScenarioBrowser } from "@/components/marketing/scenario-browser";
import { getSourceCount } from "@/lib/marketing/connector-catalog";
import { marketingPageMetadata } from "@/lib/marketing/seo";

const sourceCount = getSourceCount();

export const metadata: Metadata = marketingPageMetadata({
  title: "Pipeline scenarios",
  description:
    "Curated source-to-destination pipeline recipes — Stripe to Snowflake, GitHub to BigQuery, Postgres replication, and more. Filter by industry.",
  path: "/scenarios",
  keywords: [
    "pipeline scenarios",
    "Stripe Snowflake",
    "GitHub BigQuery",
    "ELT recipes",
    "data integration",
  ],
});

export default function ScenariosPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Recipes
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Pipeline scenarios
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        Real-world source → destination patterns teams run on eltPulse. Each scenario maps to connectors in our{" "}
        <Link href="/connectors" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          {sourceCount}+ catalog
        </Link>
        . Pick one, hit <strong className="font-medium">Start this scenario</strong>, add credentials, and run.
      </p>

      <div className="mt-12">
        <ScenarioBrowser />
      </div>

      <section className="mt-16 rounded-2xl border border-slate-200 bg-slate-50 p-8 dark:border-slate-800 dark:bg-slate-900/50">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Don&apos;t see your stack?</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Browse the full connector list or use the AI builder to scaffold REST API and catalog sources.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link
            href="/connectors"
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            Browse connectors
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link href="/sign-up" className="text-sm font-semibold text-slate-700 hover:underline dark:text-slate-300">
            Start free →
          </Link>
        </div>
      </section>
    </div>
  );
}
