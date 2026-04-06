import Link from "next/link";
import { Check } from "lucide-react";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pricing",
  description:
    "DataPulse pricing — from a free trial to self-hosted Enterprise. Usage-based, transparent, and designed for data teams of every size.",
};

const tiers = [
  {
    name: "Free",
    price: "$0",
    period: "forever",
    description: "Try the product, build pipelines, and explore the full UI before you commit.",
    features: [
      "Up to 3 pipelines",
      "Full pipeline builder (sources, destinations, quality checks)",
      "Connections catalog",
      "Sensors, schedules & partitions",
      "Community support",
    ],
    cta: { href: "/sign-up", label: "Start free" },
    highlighted: false,
    badge: null,
  },
  {
    name: "Pro",
    price: "$29",
    period: "/ month + usage",
    description:
      "For individual data engineers and small teams shipping pipelines to production.",
    features: [
      "Everything in Free",
      "Unlimited pipelines",
      "Included row volume each month",
      "Runs observability & webhook triggers",
      "Git-native artifact export",
      "Email support",
    ],
    cta: { href: "/sign-up", label: "Join waitlist" },
    highlighted: true,
    badge: "Most popular",
  },
  {
    name: "Team",
    price: "From $149",
    period: "/ month + usage",
    description:
      "Shared workspaces, role-based access, and negotiated volume for growing data orgs.",
    features: [
      "Everything in Pro",
      "Multiple workspace members",
      "Role-based access control",
      "SSO / SAML (roadmap)",
      "Dedicated Slack channel",
      "Custom row + egress rates",
    ],
    cta: { href: "mailto:hello@datapulse.dev", label: "Talk to us" },
    highlighted: false,
    badge: null,
  },
  {
    name: "Enterprise",
    price: "Custom",
    period: "",
    description:
      "Run DataPulse entirely on your own infrastructure — we ship the Docker image, you run it, and telemetry / metadata reports back to our control plane. Like Dagster+ for your stack.",
    features: [
      "Everything in Team",
      "Self-hosted DataPulse agent (Docker)",
      "Metadata & run logs reported to control plane",
      "Air-gapped option (metadata stays on-prem)",
      "SLA-backed uptime commitment",
      "Dedicated onboarding & security review",
      "Custom connector development",
    ],
    cta: { href: "mailto:hello@datapulse.dev", label: "Contact enterprise sales" },
    highlighted: false,
    badge: "Self-hosted",
  },
];

export default function PricingPage() {
  return (
    <div className="mx-auto max-w-6xl px-4 py-16 sm:px-6">
      <div className="text-center">
        <h1 className="text-3xl font-bold text-slate-900 dark:text-white sm:text-4xl">Pricing</h1>
        <p className="mt-4 max-w-2xl mx-auto text-slate-600 dark:text-slate-300">
          DataPulse is built around{" "}
          <strong className="font-semibold text-slate-800 dark:text-slate-200">usage</strong>, not just seats. Start
          free, scale on Pro or Team, or run everything on{" "}
          <strong className="font-semibold text-slate-800 dark:text-slate-200">your own infra</strong> on Enterprise.
        </p>
      </div>

      {/* Usage model callout */}
      <section
        className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/80 p-6 text-left dark:border-slate-800 dark:bg-slate-900/50 sm:p-8"
        aria-labelledby="usage-model-heading"
      >
        <h2 id="usage-model-heading" className="text-lg font-semibold text-slate-900 dark:text-white">
          How we think about cost
        </h2>
        <ul className="mt-4 list-disc space-y-2 pl-5 text-sm text-slate-600 dark:text-slate-300">
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Tiers</strong> bundle product features
            and a baseline of included row volume each month.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Metered usage</strong> applies beyond
            the included volume — additional rows and egress at a clear per-unit price.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Hosted compute</strong> is cost-plus:
            infrastructure pass-through with a transparent{" "}
            <strong className="font-medium">15% markup</strong>. Or run your own runners and pay DataPulse only for
            the control plane.
          </li>
          <li>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Enterprise self-hosted</strong> means
            your data never leaves your network — DataPulse only receives pipeline metadata, run status, and logs.
            Think Dagster+ or Prefect Cloud, but for your ELT layer.
          </li>
        </ul>
        <p className="mt-4 rounded-lg border border-dashed border-slate-300 bg-white/80 px-4 py-3 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-slate-200">Illustrative only — </span>
          final meters and prices will appear in{" "}
          <Link href="/account/billing" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Billing
          </Link>{" "}
          once live.
        </p>
      </section>

      {/* Tier cards */}
      <div className="mt-12 grid gap-6 sm:grid-cols-2 xl:grid-cols-4">
        {tiers.map((tier) => (
          <div
            key={tier.name}
            className={`relative flex flex-col rounded-2xl border p-6 ${
              tier.highlighted
                ? "border-sky-500 bg-sky-50/50 dark:border-sky-600 dark:bg-sky-950/30"
                : "border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900"
            }`}
          >
            {tier.badge && (
              <span
                className={`absolute -top-3 left-1/2 -translate-x-1/2 inline-flex rounded-full px-3 py-0.5 text-xs font-semibold ${
                  tier.highlighted
                    ? "bg-sky-600 text-white"
                    : "bg-slate-700 text-white dark:bg-slate-200 dark:text-slate-900"
                }`}
              >
                {tier.badge}
              </span>
            )}
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">{tier.name}</h2>
            <div className="mt-2 flex items-baseline gap-1">
              <span className="text-2xl font-bold text-slate-900 dark:text-white">{tier.price}</span>
              {tier.period && (
                <span className="text-sm text-slate-500 dark:text-slate-400">{tier.period}</span>
              )}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{tier.description}</p>
            <ul className="mt-6 flex flex-1 flex-col gap-2.5 text-sm text-slate-600 dark:text-slate-300">
              {tier.features.map((f) => (
                <li key={f} className="flex items-start gap-2">
                  <Check className="mt-0.5 h-4 w-4 shrink-0 text-sky-600" aria-hidden />
                  {f}
                </li>
              ))}
            </ul>
            <Link
              href={tier.cta.href}
              className={`mt-6 block rounded-lg py-2.5 text-center text-sm font-semibold ${
                tier.highlighted
                  ? "bg-sky-600 text-white hover:bg-sky-500"
                  : "border border-slate-300 text-slate-900 hover:bg-slate-50 dark:border-slate-600 dark:text-white dark:hover:bg-slate-800"
              }`}
            >
              {tier.cta.label}
            </Link>
          </div>
        ))}
      </div>

      {/* Enterprise callout */}
      <section className="mt-10 rounded-2xl border border-violet-200 bg-violet-50/60 p-6 dark:border-violet-900/50 dark:bg-violet-950/20">
        <h2 className="text-base font-semibold text-violet-900 dark:text-violet-100">
          Enterprise self-hosted — how it works
        </h2>
        <p className="mt-2 text-sm text-violet-900/80 dark:text-violet-200/80">
          DataPulse ships a Docker image you deploy into your VPC or on-prem environment. Your pipeline code, warehouse
          credentials, and raw data never leave your network. The agent sends only run metadata (status, row counts,
          timing, sanitized logs) back to the DataPulse control plane so you get full observability in the UI, webhooks,
          and alerting — without giving us access to your data.
        </p>
        <ul className="mt-3 list-inside list-disc space-y-1 text-sm text-violet-800/80 dark:text-violet-200/70">
          <li>Passes most enterprise security reviews out of the box (data never leaves your infra)</li>
          <li>Optionally run fully air-gapped — metadata reporting can be disabled for the strictest environments</li>
          <li>DataPulse team provides a dedicated onboarding, custom SLA, and connector engineering support</li>
        </ul>
        <Link
          href="mailto:hello@datapulse.dev"
          className="mt-4 inline-flex rounded-lg bg-violet-700 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-600"
        >
          Talk to enterprise sales →
        </Link>
      </section>

      <p className="mt-10 text-center text-sm text-slate-500 dark:text-slate-400">
        Evaluating against Fivetran, Airbyte, or Hevo?{" "}
        <Link href="/compare" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          See how DataPulse compares
        </Link>
        .
      </p>
    </div>
  );
}
