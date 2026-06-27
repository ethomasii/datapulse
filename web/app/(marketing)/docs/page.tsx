import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { ArrowRight } from "lucide-react";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

export const metadata: Metadata = {
  title: "Documentation",
  description:
    "Visual ELT canvas, Pulse AI, run slices, and Fivetran-grade connectors — docs for eltPulse on any warehouse.",
};

const sourceCount = getSourceCount();

const CARDS = [
  {
    href: "/docs/getting-started",
    title: "Getting started",
    desc: "Quick start, first pipeline, managed execution — no gateway required.",
  },
  {
    href: "/docs/concepts",
    title: "Concepts",
    desc: "Pipelines, runs, connections, monitors, gateways — and execution targeting.",
  },
  {
    href: "/docs/pipelines",
    title: "Pipelines & canvas",
    desc: "Visual ELT designer, generated dlt/Sling/dbt code, GitOps declarations.",
  },
  {
    href: "/docs/ai-builder",
    title: "Pulse AI",
    desc: "Natural-language pipeline creation and canvas patching with Claude.",
  },
  {
    href: "/docs/connectors",
    title: "Connectors",
    desc: `${sourceCount}+ sources and destinations — verified tiers, sync modes, run slices.`,
  },
  {
    href: "/docs/run-slices",
    title: "Run slices",
    desc: "Partition backfills and incremental windows — Fivetran-style ops without lock-in.",
  },
  {
    href: "/docs/dbt",
    title: "dbt transforms",
    desc: "Workspace dbt projects, post-load EL+T, canvas transform nodes.",
  },
  {
    href: "/docs/runs",
    title: "Runs & telemetry",
    desc: "Structured logs, live metrics, PATCH contract for runners.",
  },
  {
    href: "/docs/orchestration",
    title: "Orchestration",
    desc: "Cron schedules, monitors, pipeline chains, portable exports.",
  },
  {
    href: "/docs/webhooks",
    title: "Webhooks",
    desc: "Outgoing run notifications and incoming triggers.",
  },
  {
    href: "/docs/gateway",
    title: "Gateway",
    desc: "Self-hosted runner in your VPC — tokens, env vars, agent API.",
  },
  {
    href: "/docs/catalog",
    title: "Catalog & assets",
    desc: "Data map, metadata tags, team RBAC.",
  },
  {
    href: "/docs/integrations",
    title: "Integrations",
    desc: "GitHub sync, MCP servers, ServicePulse, API keys.",
  },
  {
    href: "/docs/repositories",
    title: "Repositories",
    desc: "eltpulse/ layout, auto-push on save, manual export.",
  },
  {
    href: "/docs/security",
    title: "Security & data",
    desc: "Auth, secrets, SSO, air-gap export.",
  },
] as const;

export default function DocsOverviewPage() {
  return (
    <DocsProse>
      <h1>Documentation</h1>
      <p className="text-lg text-slate-600 dark:text-slate-400">
        eltPulse is a <strong>visual ELT control plane</strong> for any warehouse — Lakeflow-style canvas and Pulse AI,
        Fivetran-competitive connectors with <strong>run slices</strong>, and Git-native code you own. Use managed
        execution by default or deploy a gateway in your VPC. These guides cover the product end to end.
      </p>

      <h2>What you can do</h2>
      <ul>
        <li>
          <strong>Design visually</strong> — drag sources, dbt transforms, and destinations on the{" "}
          <Link href="/builder?view=canvas">canvas</Link>; same pipeline as the form builder.
        </li>
        <li>
          <strong>Build with Pulse AI</strong> — describe pipelines in plain English; AI scaffolds config and patches the
          graph (see <Link href="/docs/ai-builder">Pulse AI</Link>).
        </li>
        <li>
          <strong>Sync {sourceCount}+ connectors</strong> — dlt and Sling codegen, verified incremental wiring, honest
          slice labels (see <Link href="/docs/connectors">Connectors</Link>).
        </li>
        <li>
          <strong>Run and observe</strong> — managed workers, live telemetry, webhooks, metrics, and 14-day activity
          charts.
        </li>
        <li>
          <strong>Ship to Git</strong> — export artifacts or auto-push pipeline YAML on save when GitHub is connected.
        </li>
      </ul>

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
          <strong>App (signed in)</strong> — Quick start, Builder &amp; canvas, Connections, Run slices, Schedules,
          Monitors, Pipeline chains, Runs, Metrics, Webhooks, MCP servers, Gateway, Catalog &amp; assets, Repositories,
          Account &amp; developers (API keys).
        </li>
        <li>
          <strong>Execution</strong> — eltPulse-managed workers by default; optional customer gateway for private
          network access.
        </li>
        <li>
          <strong>Public pages</strong> — Docs, Features, Connector catalog, Compare (e.g. vs Lakeflow, Fivetran),
          Roadmap, Changelog.
        </li>
      </ul>

      <p>
        New to eltPulse? Start with <Link href="/docs/getting-started">Getting started</Link> or jump to{" "}
        <Link href="/compare/vs-databricks-lakeflow">vs Databricks Lakeflow</Link> if you are evaluating visual ELT
        designers.
      </p>
    </DocsProse>
  );
}
