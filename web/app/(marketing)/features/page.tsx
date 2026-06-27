import Link from "next/link";
import {
  ArrowRight,
  Bot,
  Combine,
  GitBranch,
  Key,
  Layers,
  LineChart,
  PenLine,
  Shield,
  Users,
  Workflow,
  Zap,
} from "lucide-react";
import type { Metadata } from "next";
import { ApiPreview } from "@/components/marketing/api-preview";
import { CanvasPreview } from "@/components/marketing/canvas-preview";
import { ConnectorsPreview } from "@/components/marketing/connectors-preview";
import { GatewayPreview } from "@/components/marketing/gateway-preview";
import { GitPreview } from "@/components/marketing/git-preview";
import { OrchestrationPreview } from "@/components/marketing/orchestration-preview";
import { PulseAiPreview } from "@/components/marketing/pulse-ai-preview";
import { ProductPreview } from "@/components/marketing/product-preview";
import { RunsPreview } from "@/components/marketing/runs-preview";
import { TeamPreview } from "@/components/marketing/team-preview";
import { PULSE_AI_NAME } from "@/lib/brand/pulse-ai";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const sourceCount = getSourceCount();

export const metadata: Metadata = {
  title: "Features",
  description:
    "eltPulse features — visual ELT canvas, Pulse AI, Fivetran-grade connectors, managed execution, observability, and Git-native workflows on any warehouse.",
};

type PreviewKind =
  | "quickstart"
  | "canvas"
  | "pulse-ai"
  | "connectors"
  | "runs"
  | "git"
  | "orchestration"
  | "gateway"
  | "api"
  | "team";

const FEATURES: {
  icon: typeof PenLine;
  title: string;
  description: string;
  preview: PreviewKind;
  href: string;
  linkLabel: string;
}[] = [
  {
    icon: PenLine,
    title: "Visual ELT canvas",
    description:
      "Drag-and-drop pipeline designer — wire sources, native transforms, dbt, and any warehouse on one graph. The visual EL+T experience without platform lock-in.",
    preview: "canvas",
    href: "/docs/pipelines",
    linkLabel: "Canvas & pipelines docs",
  },
  {
    icon: Bot,
    title: "Pulse AI",
    description:
      "Describe changes in plain English. Pulse AI patches the canvas graph, component configs, and generated pipeline code — then you review and save.",
    preview: "pulse-ai",
    href: "/docs/ai-builder",
    linkLabel: `${PULSE_AI_NAME} docs`,
  },
  {
    icon: Layers,
    title: `${sourceCount}+ connectors`,
    description:
      "Snowflake, BigQuery, Postgres, Stripe, Salesforce, and more. Run slices, managed workers, and production-ready codegen.",
    preview: "connectors",
    href: "/connectors",
    linkLabel: "Browse connector catalog",
  },
  {
    icon: Zap,
    title: "Quick start & managed runs",
    description:
      "Destination → source → run in under a minute. eltPulse-managed compute by default — gateway only when you need private network access.",
    preview: "quickstart",
    href: "/docs/getting-started",
    linkLabel: "Getting started guide",
  },
  {
    icon: LineChart,
    title: "Runs & observability",
    description:
      "Live telemetry, row counts, logs, and activity charts. Webhooks when runs finish — the visibility Fivetran users expect, without lock-in.",
    preview: "runs",
    href: "/docs/runs",
    linkLabel: "Runs & telemetry docs",
  },
  {
    icon: GitBranch,
    title: "Git-native artifacts",
    description:
      "Export pipeline projects to your repo. Pipeline YAML auto-pushes on save when GitHub is connected — review in PRs.",
    preview: "git",
    href: "/docs/repositories",
    linkLabel: "Repositories docs",
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Invite colleagues by email, accept invites with one click, and share the org owner's pipelines. Team plan on Stripe.",
    preview: "team",
    href: "/pricing",
    linkLabel: "Team pricing",
  },
  {
    icon: Key,
    title: "Public API (beta)",
    description:
      "Workspace API keys for pipelines, runs, and connections. Automate CI/CD from your own runners — without self-hosting the control plane.",
    preview: "api",
    href: "/docs/integrations",
    linkLabel: "Integrations & API keys",
  },
  {
    icon: Shield,
    title: "BYO infrastructure",
    description:
      "Self-hosted gateway, customer-operated execution, or air-gapped enterprise. Telemetry always lands in eltPulse for a single pane of glass.",
    preview: "gateway",
    href: "/docs/gateway",
    linkLabel: "Gateway docs",
  },
  {
    icon: Workflow,
    title: "Schedules, monitors & slices",
    description:
      "Cron schedules, data quality monitors, and partition run slices — operational tooling Airbyte charges extra for, included in the builder.",
    preview: "orchestration",
    href: "/docs/orchestration",
    linkLabel: "Orchestration docs",
  },
  {
    icon: Combine,
    title: "EL + T in one plane",
    description:
      "Extract and load with dlt & Sling, transform with dbt on the same canvas — orchestration-ready from day one.",
    preview: "canvas",
    href: "/docs/dbt",
    linkLabel: "dbt transforms docs",
  },
];

const CASE_STUDIES = [
  {
    quote:
      "We wanted a visual pipeline designer on Snowflake. eltPulse gave us the canvas and Pulse AI without a platform migration.",
    role: "Data engineer",
    company: "Series B SaaS",
  },
  {
    quote:
      "Git export was the deciding factor — our dbt models and sync pipelines live in one repo now. Reviewers see the full lineage in PRs.",
    role: "Analytics lead",
    company: "E-commerce",
  },
  {
    quote:
      "Compared to Fivetran+dbt we're saving five figures annually. Usage-based billing on rows is predictable once you know your volume.",
    role: "Head of data",
    company: "Fintech",
  },
];

function FeaturePreview({ kind }: { kind: PreviewKind }) {
  switch (kind) {
    case "quickstart":
      return <ProductPreview />;
    case "canvas":
      return <CanvasPreview />;
    case "pulse-ai":
      return <PulseAiPreview />;
    case "connectors":
      return <ConnectorsPreview />;
    case "runs":
      return <RunsPreview />;
    case "git":
      return <GitPreview />;
    case "orchestration":
      return <OrchestrationPreview />;
    case "gateway":
      return <GatewayPreview />;
    case "api":
      return <ApiPreview />;
    case "team":
      return <TeamPreview />;
    default:
      return null;
  }
}

export default function FeaturesPage() {
  return (
    <div className="bg-white dark:bg-slate-950">
      <section className="border-b border-slate-200 bg-gradient-to-b from-sky-50/80 to-white px-4 py-16 dark:border-slate-800 dark:from-sky-950/30 dark:to-slate-950 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <p className="text-sm font-semibold uppercase tracking-wide text-sky-600">Platform</p>
          <h1 className="mt-2 max-w-3xl text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl">
            Visual EL+T for any warehouse — canvas, {PULSE_AI_NAME}, and code you own
          </h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-600 dark:text-slate-400">
            Drag-and-drop pipeline design, Fivetran-grade connectors, and open engines (dlt, Sling, dbt) — one control
            plane for teams who refuse to pick between ease and ownership.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/compare"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              Compare platforms
            </Link>
          </div>
        </div>
      </section>

      <section className="px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-6xl space-y-20">
          {FEATURES.map((feature, i) => {
            const Icon = feature.icon;
            const flip = i % 2 === 1;
            return (
              <div
                key={feature.title}
                className={`grid items-center gap-10 lg:grid-cols-2 ${flip ? "lg:[&>*:first-child]:order-2" : ""}`}
              >
                <div>
                  <div className="inline-flex rounded-lg bg-sky-100 p-2 dark:bg-sky-950">
                    <Icon className="h-6 w-6 text-sky-600 dark:text-sky-400" />
                  </div>
                  <h2 className="mt-4 text-2xl font-bold text-slate-900 dark:text-white">{feature.title}</h2>
                  <p className="mt-3 text-slate-600 dark:text-slate-400">{feature.description}</p>
                  <Link
                    href={feature.href}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                  >
                    {feature.linkLabel}
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden />
                  </Link>
                </div>
                <FeaturePreview kind={feature.preview} />
              </div>
            );
          })}
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/40 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Teams like yours</h2>
          <p className="mt-2 text-slate-600 dark:text-slate-400">
            Early adopters replacing legacy ELT stacks with eltPulse.
          </p>
          <div className="mt-10 grid gap-6 md:grid-cols-3">
            {CASE_STUDIES.map((c) => (
              <blockquote
                key={c.company}
                className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900"
              >
                <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{c.quote}&rdquo;</p>
                <footer className="mt-4 text-xs text-slate-500">
                  {c.role} · {c.company}
                </footer>
              </blockquote>
            ))}
          </div>
        </div>
      </section>

      <section className="px-4 py-16 text-center sm:px-6">
        <div className="mx-auto max-w-2xl">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Ready to ship pipelines?</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-400">
            Free tier includes 3 pipelines. Pro and Team include a 14-day trial — no card required to explore.
          </p>
          <Link
            href="/sign-up"
            className="mt-6 inline-flex rounded-lg bg-sky-600 px-6 py-3 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Start free
          </Link>
        </div>
      </section>
    </div>
  );
}
