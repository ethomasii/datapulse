import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { ArrowRight } from "lucide-react";

export const metadata: Metadata = {
  title: "Documentation",
  description: "Learn how DataPulse helps you design, store, and ship ELT pipelines.",
};

const CARDS = [
  {
    href: "/docs/getting-started",
    title: "Getting started",
    desc: "Sign in, create your first pipeline, export artifacts.",
  },
  {
    href: "/docs/pipelines",
    title: "Pipelines",
    desc: "Sources, destinations, generated code, and workspace manifests.",
  },
  {
    href: "/docs/orchestration",
    title: "Orchestration",
    desc: "What runs vs when: native orchestration and portable exports for Airflow, Dagster, Prefect, and more.",
  },
  {
    href: "/docs/integrations",
    title: "Integrations",
    desc: "Managed GitHub org, optional BYO OAuth, future connectors.",
  },
  {
    href: "/docs/repositories",
    title: "Repositories",
    desc: "How customer repos fit under the datapulse/ layout.",
  },
  {
    href: "/docs/security",
    title: "Security & data",
    desc: "Auth, secrets, and what we store in Neon.",
  },
] as const;

export default function DocsOverviewPage() {
  return (
    <DocsProse>
      <h1>Documentation</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        DataPulse is the hosted control plane for defining ingestion pipelines, keeping definitions in your workspace,
        and exporting runnable artifacts into repositories you control. These guides mirror how we structure product docs
        on{" "}
        <a href="https://servicepulse.dev/docs" target="_blank" rel="noreferrer">
          ServicePulse
        </a>{" "}
        — scannable sections, public URLs, and room to grow.
      </p>

      <h2>Browse guides</h2>
      <ul className="not-prose grid gap-3 sm:grid-cols-1">
        {CARDS.map((c) => (
          <li key={c.href}>
            <Link
              href={c.href}
              className="group flex items-start justify-between gap-4 rounded-xl border border-slate-200 bg-white p-4 transition hover:border-sky-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900/50 dark:hover:border-sky-800"
            >
              <div>
                <p className="font-semibold text-slate-900 dark:text-white">{c.title}</p>
                <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{c.desc}</p>
              </div>
              <ArrowRight className="mt-1 h-5 w-5 shrink-0 text-slate-400 transition group-hover:translate-x-0.5 group-hover:text-sky-600 dark:group-hover:text-sky-400" />
            </Link>
          </li>
        ))}
      </ul>

      <h2>Product map</h2>
      <ul>
        <li>
          <strong>App (signed in)</strong> — Pipelines builder, Integrations, Account &amp; Settings, and upcoming Runs /
          Repositories
          / Team.
        </li>
        <li>
          <strong>Storage</strong> — Definitions and generated text live in Postgres (Neon) per user until you sync to
          Git.
        </li>
        <li>
          <strong>Public pages</strong> — Docs, Roadmap, and Changelog are available without signing in.
        </li>
      </ul>
    </DocsProse>
  );
}
