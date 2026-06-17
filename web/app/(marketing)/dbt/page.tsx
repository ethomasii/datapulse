import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, GitBranch, Layers, Workflow } from "lucide-react";
import { marketingPageMetadata } from "@/lib/marketing/seo";

export const metadata: Metadata = marketingPageMetadata({
  title: "dbt & transformations",
  description:
    "Run dbt after dlt loads in eltPulse — post-load transforms, dlt-hub packages, slice-aware vars, and Git-native projects in one repo.",
  path: "/dbt",
  keywords: ["dbt", "dlt", "ELT", "transformations", "Fivetran dbt", "staging models"],
});

const DBT_HUB_PACKAGES = [
  { source: "Stripe", slug: "stripe_analytics", package: "dlt-hub/stripe_source" },
  { source: "GitHub", slug: "github", package: "dlt-hub/github_source" },
  { source: "HubSpot", slug: "hubspot", package: "dlt-hub/hubspot_source" },
  { source: "Salesforce", slug: "salesforce", package: "dlt-hub/salesforce_source" },
  { source: "Shopify", slug: "shopify_dlt", package: "dlt-hub/shopify_source" },
  { source: "Google Ads", slug: "google_ads", package: "dlt-hub/google_ads_source" },
  { source: "Google Analytics", slug: "google_analytics", package: "dlt-hub/google_analytics_source" },
  { source: "Facebook Ads", slug: "facebook_ads", package: "dlt-hub/facebook_ads_source" },
];

const FLOW = [
  {
    step: "1",
    title: "Extract & load",
    body: "eltPulse scaffolds dlt or Sling pipelines and runs them on managed workers, your gateway, or GitHub Actions.",
  },
  {
    step: "2",
    title: "Transform with dbt",
    body: "Enable post-load dbt in the builder. Generated Python appends a dlt dbt runner step after `pipeline.run()`.",
  },
  {
    step: "3",
    title: "Review in Git",
    body: "Pipeline code, workspace YAML, and your dbt project live in the same repo — PRs show the full lineage.",
  },
];

export default function DbtMarketingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
        Extract · Load · Transform
      </p>
      <h1 className="mt-2 max-w-3xl text-3xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-4xl">
        dbt after dlt — without another control plane
      </h1>
      <p className="mt-4 max-w-3xl text-lg text-slate-600 dark:text-slate-300">
        Fivetran and dbt merged because teams want ingest and modeling together. eltPulse takes a different angle:{" "}
        <strong className="font-medium text-slate-800 dark:text-slate-100">you own the code</strong>. We scaffold
        connectors and wire a post-load dbt step via{" "}
        <a
          href="https://dlthub.com/docs/dlt-ecosystem/transformations/dbt"
          className="font-medium text-sky-600 hover:underline dark:text-sky-400"
          target="_blank"
          rel="noreferrer"
        >
          dlt&apos;s dbt integration
        </a>
        — your project, your warehouse, your CI.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/sign-up"
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
        >
          Try eltPulse free
          <ArrowRight className="h-4 w-4" />
        </Link>
        <Link
          href="/docs/dbt"
          className="inline-flex items-center rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-semibold text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-900"
        >
          dbt docs
        </Link>
      </div>

      <section className="mt-16 grid gap-6 sm:grid-cols-3">
        {FLOW.map(({ step, title, body }) => (
          <div
            key={step}
            className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
              {step}
            </span>
            <h2 className="mt-4 font-semibold text-slate-900 dark:text-white">{title}</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{body}</p>
          </div>
        ))}
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">What&apos;s in the product today</h2>
        <ul className="mt-6 grid gap-4 sm:grid-cols-2">
          {[
            {
              icon: Layers,
              title: "Post-load dbt in the builder",
              body: "Set a dbt package path (local or git), dataset name, selector, and branch. Codegen appends the dlt dbt runner to generated pipelines.",
            },
            {
              icon: Workflow,
              title: "Slice-aware transforms",
              body: "Partitioned runs pass slice value and column into dbt via configurable var names — map to your existing `var()` calls.",
            },
            {
              icon: GitBranch,
              title: "Same repo as pipelines",
              body: "Export dlt/Sling + workspace YAML + your dbt project. Auto Git push on save keeps declarations in sync.",
            },
          ].map(({ icon: Icon, title, body }) => (
            <li
              key={title}
              className="flex gap-4 rounded-xl border border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/40"
            >
              <Icon className="mt-0.5 h-6 w-6 shrink-0 text-sky-600" aria-hidden />
              <div>
                <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{body}</p>
              </div>
            </li>
          ))}
        </ul>
        <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
          eltPulse is not dbt Cloud — we don&apos;t host your dbt IDE or semantic layer. We orchestrate{" "}
          <em>when</em> dbt runs relative to loads and keep definitions versioned with your pipelines.
        </p>
      </section>

      <section className="mt-16">
        <h2 className="text-xl font-bold text-slate-900 dark:text-white">dlt-hub dbt packages</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          Community staging models for verified sources. Point your pipeline&apos;s dbt step at a package path or add
          these via <code className="text-xs">packages.yml</code> in your project.
        </p>
        <div className="mt-6 overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
          <table className="w-full min-w-[32rem] text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500 dark:border-slate-800 dark:bg-slate-900">
              <tr>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">dbt package</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {DBT_HUB_PACKAGES.map((row) => (
                <tr key={row.slug} className="bg-white dark:bg-slate-950">
                  <td className="px-4 py-3 font-medium text-slate-900 dark:text-white">{row.source}</td>
                  <td className="px-4 py-3 font-mono text-xs text-slate-600 dark:text-slate-400">{row.package}</td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/connectors/${row.slug}`}
                      className="text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Connector →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="mt-16 rounded-2xl border border-sky-200 bg-gradient-to-br from-sky-50 to-white p-8 dark:border-sky-900 dark:from-sky-950/40 dark:to-slate-950">
        <h2 className="text-lg font-bold text-slate-900 dark:text-white">Pair with a scenario</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Start with{" "}
          <Link href="/scenarios" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Stripe → Snowflake
          </Link>{" "}
          or{" "}
          <Link href="/scenarios" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            GitHub → BigQuery
          </Link>
          , then enable dbt staging in the pipeline builder.
        </p>
        <Link
          href="/compare"
          className="mt-4 inline-flex text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
        >
          How we compare to Fivetran + dbt →
        </Link>
      </section>
    </div>
  );
}
