import Link from "next/link";
import {
  ArrowRight,
  Bot,
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
import { CanvasPreview } from "@/components/marketing/canvas-preview";
import { PulseAiPreview } from "@/components/marketing/pulse-ai-preview";
import { ProductPreview } from "@/components/marketing/product-preview";
import { RunsPreview } from "@/components/marketing/runs-preview";
import { PULSE_AI_NAME } from "@/lib/brand/pulse-ai";

export const metadata: Metadata = {
  title: "Features",
  description:
    "eltPulse features — visual ELT canvas, Pulse AI assistant, Lakeflow-style designer for any warehouse, managed execution, observability, and Git-native workflows.",
};

const FEATURES = [
  {
    icon: PenLine,
    title: "Visual ELT canvas",
    description:
      "Drag-and-drop pipeline designer — sources, native transforms, dbt, and any warehouse on one graph. The Lakeflow experience without Databricks lock-in.",
    preview: "canvas" as const,
  },
  {
    icon: Bot,
    title: "Pulse AI",
    description:
      "Describe changes in plain English. Pulse AI patches the canvas graph, component configs, and generated pipeline code — then you review and save.",
    preview: "pulse-ai" as const,
  },
  {
    icon: Layers,
    title: "111+ connectors",
    description:
      "Snowflake, BigQuery, Postgres, Stripe, Salesforce, and more. Run slices, managed workers, and production-ready codegen.",
    preview: "canvas" as const,
  },
  {
    icon: Zap,
    title: "Quick start & managed runs",
    description:
      "Destination → source → run in under a minute. eltPulse-managed compute by default — gateway only when you need private network access.",
    preview: "quickstart" as const,
  },
  {
    icon: LineChart,
    title: "Runs & observability",
    description:
      "Live telemetry, row counts, logs, and activity charts. Webhooks when runs finish — the visibility Fivetran users expect, without lock-in.",
    preview: "runs" as const,
  },
  {
    icon: GitBranch,
    title: "Git-native artifacts",
    description:
      "Export pipeline projects to your repo. Pipeline YAML auto-pushes on save when GitHub is connected — review in PRs.",
    preview: "canvas" as const,
  },
  {
    icon: Users,
    title: "Team workspaces",
    description:
      "Invite colleagues by email, accept invites with one click, and share the org owner's pipelines. Team plan on Stripe.",
    preview: "quickstart" as const,
  },
  {
    icon: Key,
    title: "Public API (beta)",
    description:
      "Workspace API keys for pipelines, runs, and connections. Automate CI/CD from your own runners — without self-hosting the control plane.",
    preview: null,
  },
  {
    icon: Shield,
    title: "BYO infrastructure",
    description:
      "Self-hosted gateway, customer-operated execution, or air-gapped enterprise. Telemetry always lands in eltPulse for a single pane of glass.",
    preview: null,
  },
  {
    icon: Workflow,
    title: "Schedules, monitors & slices",
    description:
      "Cron schedules, data quality monitors, and partition run slices — operational tooling Airbyte charges extra for, included in the builder.",
    preview: "runs" as const,
  },
];

const CASE_STUDIES = [
  {
    quote:
      "We wanted Lakeflow's canvas on Snowflake. eltPulse gave us the designer and Pulse AI without a Databricks migration.",
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

function FeaturePreview({ kind }: { kind: "quickstart" | "canvas" | "pulse-ai" | "runs" | null }) {
  if (kind === "quickstart") return <ProductPreview />;
  if (kind === "canvas") return <CanvasPreview />;
  if (kind === "pulse-ai") return <PulseAiPreview />;
  if (kind === "runs") return <RunsPreview />;
  return null;
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
            Lakeflow-style designer, Fivetran-grade connectors, and open engines (dlt, Sling, dbt) — one control plane
            for teams who refuse to pick between ease and ownership.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link
              href="/sign-up"
              className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-sky-500"
            >
              Start free <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/compare/vs-databricks-lakeflow"
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-200 dark:hover:bg-slate-900"
            >
              vs Lakeflow
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
                  {feature.title.includes("connectors") ? (
                    <Link
                      href="/connectors"
                      className="mt-3 inline-flex text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
                    >
                      Browse connector catalog →
                    </Link>
                  ) : null}
                </div>
                {feature.preview ? (
                  <FeaturePreview kind={feature.preview} />
                ) : (
                  <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-12 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40">
                    Configure in app → Account → Developers
                  </div>
                )}
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
