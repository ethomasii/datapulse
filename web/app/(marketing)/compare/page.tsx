import type { Metadata } from "next";
import Link from "next/link";
import { Code2, GitBranch, Server, Wallet } from "lucide-react";
import {
  FEATURED_COMPETITORS,
  MORE_COMPETITORS,
} from "@/lib/marketing/competitors";
import { CompareCompetitorCard } from "@/components/marketing/compare-competitor-card";

export const metadata: Metadata = {
  title: "Compare — eltPulse vs Fivetran, Airbyte, Lakeflow & other ELT tools",
  description:
    "Honest comparisons vs Fivetran, Airbyte, Databricks Lakeflow, Snowflake, Matillion, and more — plus extended write-ups for other tools.",
};

const HIGHLIGHTS = [
  {
    icon: GitBranch,
    title: "Git-native by default",
    body: "Pipeline definitions live in your repo — PRs, environments, and ownership like application code.",
  },
  {
    icon: Server,
    title: "Your compute, any tier",
    body: "Customer gateways on Free, Pro, and Team — or eltPulse-managed workers when you want zero ops.",
  },
  {
    icon: Wallet,
    title: "Transparent usage economics",
    body: "Subscription + metered rows and egress — no black-box MAR surprises as you scale.",
  },
  {
    icon: Code2,
    title: "Open engines, product shell",
    body: "Built on dlt, Sling, and dbt — with catalog, runs, monitors, and Git export in one control plane.",
  },
];

export default function ComparePage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <section className="bg-slate-100 py-24 text-center dark:bg-slate-950">
        <div className="mx-auto max-w-3xl px-6">
          <span className="mb-4 inline-block rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            How we stack up
          </span>
          <h1 className="mt-4 text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl">
            eltPulse vs. the alternatives
          </h1>
          <p className="mt-6 text-lg text-slate-600 dark:text-slate-400">
            Start with the comparisons buyers ask about most — Fivetran, Airbyte, Databricks Lakeflow, Snowflake,
            Matillion, and peers. Every write-up is respectful: we say when another tool is the better fit.
          </p>
        </div>
      </section>

      <section className="border-b border-slate-200 py-16 dark:border-slate-800">
        <div className="mx-auto max-w-5xl px-6">
          <div className="grid gap-8 sm:grid-cols-2">
            {HIGHLIGHTS.map(({ icon: Icon, title, body }) => (
              <div key={title} className="flex gap-4">
                <div className="mt-1 shrink-0 rounded-lg bg-blue-50 p-2 dark:bg-blue-950/40">
                  <Icon className="h-5 w-5 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h3 className="font-semibold text-slate-900 dark:text-white">{title}</h3>
                  <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-5xl px-6 py-20">
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white">Popular comparisons</h2>
        <p className="mb-12 text-center text-slate-500 dark:text-slate-400">
          Feature-by-feature breakdowns for the tools most teams evaluate alongside eltPulse.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURED_COMPETITORS.map((c) => (
            <CompareCompetitorCard key={c.slug} competitor={c} />
          ))}
        </div>

        {MORE_COMPETITORS.length > 0 ? (
          <details className="group mx-auto mt-16 max-w-3xl rounded-2xl border border-slate-200 bg-slate-50 open:pb-6 dark:border-slate-800 dark:bg-slate-900/50">
            <summary className="cursor-pointer list-none px-6 py-4 text-center marker:content-none">
              <span className="text-sm font-semibold text-blue-600 group-open:hidden dark:text-blue-400">
                More comparisons ({MORE_COMPETITORS.length}) — Hevo, Meltano, Hightouch, enterprise suites…
              </span>
              <span className="hidden text-sm font-semibold text-slate-600 group-open:inline dark:text-slate-300">
                More comparisons
              </span>
            </summary>
            <p className="px-6 text-center text-xs text-slate-500 dark:text-slate-400">
              Still indexed for search — just not every vendor belongs in the main nav.
            </p>
            <ul className="mt-4 columns-1 gap-x-8 px-6 sm:columns-2 md:columns-3">
              {MORE_COMPETITORS.map((c) => (
                <li key={c.slug} className="mb-2 break-inside-avoid">
                  <Link
                    href={`/compare/${c.slug}`}
                    className="text-sm text-slate-700 hover:text-blue-600 hover:underline dark:text-slate-300 dark:hover:text-blue-400"
                  >
                    vs. {c.name}
                  </Link>
                </li>
              ))}
            </ul>
          </details>
        ) : null}
      </section>

      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">See how eltPulse fits your stack</h2>
        <p className="mt-2 text-blue-200">Start free — connect a source and run your first pipeline in minutes.</p>
        <div className="mt-6 flex flex-wrap justify-center gap-4">
          <Link
            href="/sign-up"
            className="rounded-lg bg-white px-8 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
          >
            Start free →
          </Link>
          <Link
            href="/pricing"
            className="rounded-lg border border-blue-400 px-8 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
          >
            View pricing
          </Link>
        </div>
      </section>
    </div>
  );
}
