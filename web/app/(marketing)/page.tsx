import Link from "next/link";
import {
  ArrowRight,
  Bot,
  CheckCircle2,
  GitBranch,
  Layers,
  LineChart,
  Shield,
  Sparkles,
  Workflow,
  Zap,
} from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import { ProductPreview } from "@/components/marketing/product-preview";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const CONNECTOR_CHIPS: { label: string; slug: string }[] = [
  { label: "Snowflake", slug: "snowflake" },
  { label: "BigQuery", slug: "bigquery" },
  { label: "Postgres", slug: "postgres" },
  { label: "DuckDB", slug: "duckdb" },
  { label: "GitHub", slug: "github" },
  { label: "Stripe", slug: "stripe_analytics" },
  { label: "Salesforce", slug: "salesforce" },
  { label: "HubSpot", slug: "hubspot" },
  { label: "S3", slug: "s3" },
  { label: "Kafka", slug: "kafka" },
];

const features = [
  {
    icon: Layers,
    title: "Any source, any destination",
    description:
      "Pick from the connector catalog. eltPulse scaffolds production-ready sync code for your stack.",
  },
  {
    icon: Zap,
    title: "Minutes to first sync",
    description:
      "Connect credentials, pick a source, hit Run. Managed execution is the default — no Docker or gateway setup required.",
  },
  {
    icon: Bot,
    title: "AI-assisted pipelines",
    description:
      "Describe what you need in plain English. The builder scaffolds source config, tests, and workspace YAML for you.",
  },
  {
    icon: LineChart,
    title: "Runs & observability",
    description:
      "Live telemetry, row counts, logs, and 14-day activity charts. Webhooks fire when runs finish.",
  },
  {
    icon: GitBranch,
    title: "Git-native",
    description:
      "Export artifacts to your repo, review in PRs, and sync with GitHub. Pipeline definitions live where your team already works.",
  },
  {
    icon: Shield,
    title: "Your infra or ours",
    description:
      "Run on eltPulse-managed workers or deploy a gateway in your VPC. Enterprise keeps data on-prem; we only see metadata.",
  },
];

const testimonials = [
  {
    quote:
      "We went from zero to a Stripe → Snowflake pipeline in under ten minutes. No Airflow DAG, no custom Python boilerplate.",
    name: "Alex Kim",
    role: "Data Engineer @ Series B startup",
  },
  {
    quote:
      "The source catalog wizard is what Fivetran should have been for teams that want to own the code. Git export sealed it.",
    name: "Jordan Lee",
    role: "Platform Lead @ Fintech",
  },
  {
    quote:
      "Finally a control plane that doesn't lock us in. We run the gateway in our VPC and still get full run history in the UI.",
    name: "Sam Okonkwo",
    role: "Head of Data @ Healthtech",
  },
];

const pricingPreview = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    highlight: "3 pipelines, full builder",
    cta: "Start free",
    href: "/sign-up",
    popular: false,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/mo + usage",
    highlight: "Unlimited pipelines, observability",
    cta: "Start free trial",
    href: "/sign-up",
    popular: true,
  },
  {
    name: "Team",
    price: "From $149",
    period: "/mo + usage",
    highlight: "Shared workspace, RBAC",
    cta: "Talk to us",
    href: "mailto:hello@eltpulse.dev",
    popular: false,
  },
];

export default function HomePage() {
  const sourceCount = getSourceCount();
  return (
    <div>
      {/* Hero — two column with product preview */}
      <section className="border-b border-slate-200 bg-gradient-to-b from-white via-slate-50/50 to-slate-50 px-4 py-16 dark:border-slate-800 dark:from-slate-950 dark:via-slate-900/50 dark:to-slate-900 sm:px-6 sm:py-20">
        <div className="mx-auto grid max-w-6xl items-center gap-12 lg:grid-cols-2 lg:gap-16">
          <div className="text-center lg:text-left">
            <p className="mb-4 inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-medium text-sky-800 dark:border-sky-900 dark:bg-sky-950 dark:text-sky-200">
              <Sparkles className="h-3.5 w-3.5" aria-hidden />
              Now with Quick start — first sync in minutes
            </p>
            <h1 className="text-balance text-4xl font-bold tracking-tight text-slate-900 dark:text-white sm:text-5xl lg:text-[2.75rem] lg:leading-tight">
              ELT pipelines without the friction
            </h1>
            <p className="mt-6 text-lg text-slate-600 dark:text-slate-300">
              As easy as <span className="font-medium text-slate-800 dark:text-slate-200">Fivetran</span>, as flexible
              as owning your own pipelines. Design, run, and observe data movement — you own the code, we handle
              orchestration.
            </p>
            <div className="mt-8 flex flex-wrap items-center justify-center gap-4 lg:justify-start">
              <Link
                href="/sign-up"
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-5 py-2.5 text-sm font-semibold text-white shadow-lg shadow-sky-600/25 hover:bg-sky-500"
              >
                Start free — no card required
                <ArrowRight className="h-4 w-4" aria-hidden />
              </Link>
              <Link
                href="/docs/getting-started"
                className="text-sm font-medium text-slate-600 underline-offset-4 hover:text-slate-900 hover:underline dark:text-slate-300 dark:hover:text-white"
              >
                Read the docs
              </Link>
            </div>
            <p className="mt-4 text-xs text-slate-500 dark:text-slate-400">
              <Link href="/connectors" className="hover:text-sky-600 dark:hover:text-sky-400">
                {sourceCount}+ connectors
              </Link>
              {" · "}
              <Link href="/scenarios" className="hover:text-sky-600 dark:hover:text-sky-400">
                Pipeline scenarios
              </Link>
              {" · Managed execution · Git-native export"}
            </p>
          </div>
          <ProductPreview />
        </div>
      </section>

      {/* Connector strip */}
      <section className="border-b border-slate-200 bg-white px-4 py-10 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <p className="text-center text-sm font-medium text-slate-500 dark:text-slate-400">
          Connect sources and destinations like
        </p>
        <div className="mx-auto mt-5 flex max-w-4xl flex-wrap items-center justify-center gap-3">
          {CONNECTOR_CHIPS.map(({ label, slug }) => (
            <Link
              key={slug}
              href={`/connectors/${slug}`}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-1.5 text-sm font-medium text-slate-700 transition hover:border-sky-300 hover:bg-sky-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-800"
            >
              <ConnectorIcon slug={slug} name={label} size={16} />
              {label}
            </Link>
          ))}
          <Link
            href="/connectors"
            className="rounded-full border border-dashed border-slate-300 px-4 py-1.5 text-sm font-medium text-sky-600 hover:border-sky-400 dark:border-slate-600 dark:text-sky-400"
          >
            +{Math.max(0, sourceCount - CONNECTOR_CHIPS.length)} more
          </Link>
        </div>
        <p className="mt-4 text-center text-sm">
          <Link href="/scenarios" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            See pipeline scenarios →
          </Link>
        </p>
      </section>

      {/* Problem statement */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white sm:text-3xl">
            Stop duct-taping your data stack
          </h2>
          <p className="mt-4 text-slate-600 dark:text-slate-300">
            Fivetran is push-button but you don&apos;t own the logic. DIY open-source stacks are powerful but you still
            wire up runners, secrets, and observability yourself. eltPulse gives you both: one-click scaffolding and
            full code export.
          </p>
        </div>
      </section>

      {/* Features grid */}
      <section className="border-t border-slate-200 bg-slate-50/50 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/30 sm:px-6">
        <div className="mx-auto max-w-6xl">
          <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
            Built for data engineers who ship
          </h2>
          <ul className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {features.map(({ icon: Icon, title, description }) => (
              <li
                key={title}
                className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
              >
                <Icon className="h-8 w-8 text-sky-600" aria-hidden />
                <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
                <p className="mt-2 text-sm leading-relaxed text-slate-600 dark:text-slate-300">{description}</p>
              </li>
            ))}
          </ul>
          <p className="mt-10 text-center">
            <Link
              href="/features"
              className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
            >
              Explore all features <ArrowRight className="h-4 w-4" />
            </Link>
          </p>
        </div>
      </section>
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">Three steps to flowing data</h2>
        <ol className="mt-12 grid gap-8 sm:grid-cols-3">
          {[
            {
              step: "1",
              title: "Connect",
              desc: "Add your warehouse and source credentials once. Test before you save.",
            },
            {
              step: "2",
              title: "Build",
              desc: "Pick a connector from the catalog or ask the AI assistant. Review and export generated pipeline code.",
            },
            {
              step: "3",
              title: "Run",
              desc: "Trigger a sync from the builder or schedule it. Watch live telemetry in Runs.",
            },
          ].map(({ step, title, desc }) => (
            <li key={step} className="text-center">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-full bg-sky-600 text-sm font-bold text-white">
                {step}
              </div>
              <h3 className="mt-4 text-lg font-semibold text-slate-900 dark:text-white">{title}</h3>
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{desc}</p>
            </li>
          ))}
        </ol>
        <div className="mt-10 text-center">
          <Link
            href="/sign-up"
            className="inline-flex items-center gap-2 text-sm font-semibold text-sky-600 hover:underline dark:text-sky-400"
          >
            Try it now <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </section>

      {/* Integrations callout */}
      <section className="border-y border-slate-200 bg-white px-4 py-14 dark:border-slate-800 dark:bg-slate-950 sm:px-6">
        <div className="mx-auto max-w-4xl">
          <div className="flex items-start gap-4">
            <Workflow className="mt-1 h-8 w-8 shrink-0 text-sky-600" aria-hidden />
            <div>
              <h2 className="text-xl font-bold text-slate-900 dark:text-white">
                Orchestration-ready from day one
              </h2>
              <p className="mt-2 text-slate-600 dark:text-slate-300">
                Every pipeline ships with workspace YAML — schedules, owners, tags, and monitor hooks. Connect a
                customer gateway in your VPC, use eltPulse-managed workers, or export to Dagster and dbt when you&apos;re
                ready.
              </p>
              <ul className="mt-4 grid gap-2 sm:grid-cols-2">
                {[
                  "Cron schedules & file-arrival monitors",
                  "Run slices for partitioned backfills",
                  "Outgoing webhooks on run completion",
                  "Auto Git push on pipeline save",
                ].map((item) => (
                  <li key={item} className="flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle2 className="h-4 w-4 shrink-0 text-emerald-600" aria-hidden />
                    {item}
                  </li>
                ))}
              </ul>
              <Link
                href="/docs/orchestration"
                className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
              >
                Orchestration docs →
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
        <h2 className="text-center text-2xl font-bold text-slate-900 dark:text-white">
          Loved by data platform teams
        </h2>
        <ul className="mt-12 grid gap-6 sm:grid-cols-3">
          {testimonials.map(({ quote, name, role }) => (
            <li
              key={name}
              className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-sm leading-relaxed text-slate-700 dark:text-slate-300">&ldquo;{quote}&rdquo;</p>
              <div className="mt-4 border-t border-slate-100 pt-4 dark:border-slate-800">
                <p className="text-sm font-semibold text-slate-900 dark:text-white">{name}</p>
                <p className="text-xs text-slate-500 dark:text-slate-400">{role}</p>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Pricing preview */}
      <section className="border-t border-slate-200 bg-slate-50/50 px-4 py-16 dark:border-slate-800 dark:bg-slate-900/30 sm:px-6">
        <div className="mx-auto max-w-4xl text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">Simple, transparent pricing</h2>
          <p className="mt-3 text-slate-600 dark:text-slate-300">Start free. Scale on usage when you&apos;re ready.</p>
        </div>
        <div className="mx-auto mt-10 grid max-w-4xl gap-6 sm:grid-cols-3">
          {pricingPreview.map((tier) => (
            <div
              key={tier.name}
              className={`relative flex flex-col rounded-2xl border p-6 ${
                tier.popular
                  ? "border-sky-500 bg-sky-50/50 dark:border-sky-600 dark:bg-sky-950/30"
                  : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
              }`}
            >
              {tier.popular && (
                <span className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-sky-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most popular
                </span>
              )}
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white">{tier.name}</h3>
              <div className="mt-2 flex items-baseline gap-1">
                <span className="text-2xl font-bold text-slate-900 dark:text-white">{tier.price}</span>
                <span className="text-sm text-slate-500">{tier.period}</span>
              </div>
              <p className="mt-3 flex-1 text-sm text-slate-600 dark:text-slate-300">{tier.highlight}</p>
              <Link
                href={tier.href}
                className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-semibold ${
                  tier.popular
                    ? "bg-sky-600 text-white hover:bg-sky-500"
                    : "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
                }`}
              >
                {tier.cta}
              </Link>
            </div>
          ))}
        </div>
        <p className="mt-8 text-center text-sm text-slate-500 dark:text-slate-400">
          <Link href="/pricing" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Full pricing details →
          </Link>
          {" · "}
          <Link href="/compare" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Compare vs Fivetran & Airbyte →
          </Link>
        </p>
      </section>

      {/* Final CTA */}
      <section className="border-t border-slate-200 bg-gradient-to-b from-sky-600 to-sky-700 px-4 py-16 dark:border-slate-800 sm:px-6">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-bold text-white sm:text-3xl">Your first pipeline is minutes away.</h2>
          <p className="mt-4 text-sky-100">
            Join data teams using eltPulse to move faster without giving up code ownership.
          </p>
          <Link
            href="/sign-up"
            className="mt-8 inline-flex items-center gap-2 rounded-lg bg-white px-6 py-3 text-sm font-semibold text-sky-700 hover:bg-sky-50"
          >
            Start free
            <ArrowRight className="h-4 w-4" aria-hidden />
          </Link>
        </div>
      </section>
    </div>
  );
}
