import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, CheckCircle, Code2, GitBranch, Server, Wallet } from "lucide-react";
import { COMPETITORS } from "@/lib/marketing/competitors";

export const metadata: Metadata = {
  title: "Compare — eltPulse vs Fivetran, Matillion, Informatica, Meltano & other ELT tools",
  description:
    "Honest comparisons: eltPulse vs Databricks Lakeflow, Fivetran, Snowflake, Matillion, Informatica, Hightouch (reverse ETL), and 15+ more.",
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
            Buyers compare Fivetran, Databricks Lakeflow, Snowflake native EL, Matillion, Informatica,
            and many others — plus activation tools like Hightouch (a different layer). Each excels in its
            lane; we explain where eltPulse fits for git-native platform teams.
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
        <h2 className="mb-2 text-center text-2xl font-bold text-slate-900 dark:text-white">Pick your comparison</h2>
        <p className="mb-12 text-center text-slate-500 dark:text-slate-400">
          Detailed, honest feature-by-feature breakdowns. Orchestration tools (Prefect, Airflow, Dagster) are
          partners — we focus on EL+T control planes and adjacent categories like reverse ETL.
        </p>
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {COMPETITORS.map((c) => (
            <Link
              key={c.slug}
              href={`/compare/${c.slug}`}
              className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:shadow-blue-900/20"
            >
              <div className="flex items-start justify-between">
                <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
                  eltPulse vs. {c.name}
                </h3>
                <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-500" />
              </div>
              <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{c.description}</p>
              <div className="mt-4 space-y-1.5">
                {c.theyreGoodAt.slice(0, 2).map((strength) => (
                  <div key={strength} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
                    {strength}
                  </div>
                ))}
                <div className="flex items-start gap-2 text-xs font-medium text-blue-600 dark:text-blue-400">
                  <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-blue-500" />
                  Strong fit for their core use case — see how eltPulse differs
                </div>
              </div>
            </Link>
          ))}
        </div>
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
