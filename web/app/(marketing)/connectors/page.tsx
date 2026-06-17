import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ConnectorCatalogBrowser } from "@/components/marketing/connector-catalog-browser";
import { ScenarioCardGrid, ScenariosCta } from "@/components/marketing/scenario-cards";
import {
  connectorCatalogStats,
  getConnectorCategories,
  getMarketingDestinations,
  getMarketingSources,
  getSourceCount,
} from "@/lib/marketing/connector-catalog";
import { marketingPageMetadata } from "@/lib/marketing/seo";
import { PIPELINE_SCENARIOS } from "@/lib/marketing/pipeline-scenarios";

const stats = connectorCatalogStats();
const sourceCount = getSourceCount();

export const metadata: Metadata = marketingPageMetadata({
  title: "Connectors — sources & destinations",
  description: `Browse ${sourceCount}+ ingestion sources and warehouse destinations supported by eltPulse — powered by dlt and Sling.`,
  path: "/connectors",
  keywords: ["connectors", "data sources", "Snowflake", "Stripe", "GitHub", "dlt", "Sling", "ELT"],
});

export default function ConnectorsPage() {
  const sources = getMarketingSources();
  const destinations = getMarketingDestinations();
  const categories = getConnectorCategories();

  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Connector catalog
      </p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        Sources &amp; destinations
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        eltPulse ships with{" "}
        <strong className="font-medium text-slate-800 dark:text-slate-100">{sourceCount}+ sources</strong> from the
        dlt hub registry plus {stats.destinationCount} warehouse and database destinations. Pick a connector to see auth
        requirements, tooling (dlt vs Sling), and real-world pipeline scenarios.
      </p>

      <div className="mt-8 grid gap-4 sm:grid-cols-3">
        {[
          { label: "Sources", value: String(stats.sourceCount) },
          { label: "Destinations", value: String(stats.destinationCount) },
          { label: "Categories", value: String(stats.categoryCount) },
        ].map((s) => (
          <div
            key={s.label}
            className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 dark:border-slate-800 dark:bg-slate-900/50"
          >
            <p className="text-2xl font-bold text-slate-900 dark:text-white">{s.value}</p>
            <p className="text-sm text-slate-500 dark:text-slate-400">{s.label}</p>
          </div>
        ))}
      </div>

      <section className="mt-14">
        <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h2 className="text-xl font-bold text-slate-900 dark:text-white">Popular scenarios</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Curated source → destination recipes teams run on day one.
            </p>
          </div>
          <ScenariosCta />
        </div>
        <ScenarioCardGrid scenarios={PIPELINE_SCENARIOS.slice(0, 4)} />
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Browse the catalog</h2>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
          Verified connectors have production codegen and credential UX. Catalog entries are available in the builder
          with AI-assisted configuration.
        </p>
        <div className="mt-8">
          <ConnectorCatalogBrowser sources={sources} destinations={destinations} categories={categories} />
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-8 dark:border-sky-900 dark:from-sky-950/40 dark:to-slate-950">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">Ready to wire one up?</h2>
        <p className="mt-2 max-w-xl text-sm text-slate-600 dark:text-slate-300">
          Quick start walks destination → source → credentials → run. Managed execution is included on the free tier.
        </p>
        <div className="mt-6 flex flex-wrap gap-3">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Start free
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/docs/connectors"
            className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
          >
            Connector docs
          </Link>
        </div>
      </section>
    </div>
  );
}
