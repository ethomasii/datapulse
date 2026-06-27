"use client";

import Link from "next/link";
import { useState, type ReactNode } from "react";
import { Check, X } from "lucide-react";
import {
  displayMonthlyUsd,
  formatUsd,
  PLAN_PRICES_USD,
  type BillingInterval,
} from "@/lib/billing/plan-pricing";
import {
  PRICING_COMPARISON_SECTIONS,
  PRICING_FAQ,
  PRICING_TIER_LABELS,
  type ComparisonCell,
  type PricingTierKey,
} from "@/lib/marketing/pricing-comparison";

type TierDef = {
  key: PricingTierKey;
  subtitle: string;
  monthlyUsd: number | null;
  features: string[];
  cta: { href: string; label: string; primary?: boolean };
  badge?: string;
  highlighted?: boolean;
};

const TIERS: TierDef[] = [
  {
    key: "free",
    subtitle: "For individuals getting started",
    monthlyUsd: 0,
    features: [
      "Up to 3 pipelines",
      "Full pipeline builder & catalog",
      "Managed compute (shared pool) or 1 personal gateway",
      "Monitors, schedules & run slices",
      "14-day run history",
      "Community support",
    ],
    cta: { href: "/sign-up", label: "Get started free" },
  },
  {
    key: "pro",
    subtitle: "For data engineers and small teams",
    monthlyUsd: PLAN_PRICES_USD.pro.monthly,
    badge: "Most Popular",
    highlighted: true,
    features: [
      "Everything in Free",
      "Unlimited pipelines",
      "Included row volume each month",
      "90-day run history & telemetry",
      "Webhook triggers & API keys",
      "Git-native artifact export",
      "Customer gateway in your VPC (5 gateways)",
      "Email support",
    ],
    cta: { href: "/sign-up", label: "Start Pro — 14 days free", primary: true },
  },
  {
    key: "team",
    subtitle: "For platform and data orgs",
    monthlyUsd: PLAN_PRICES_USD.team.monthly,
    features: [
      "Everything in Pro",
      "Pulse AI — natural-language pipeline builder",
      "Multiple workspace members",
      "Role-based access control",
      "1-year run history",
      "Optional dedicated managed compute",
      "Org-scoped gateway tokens",
      "Custom row + egress rates",
      "Priority support",
    ],
    cta: { href: "/sign-up", label: "Start Team — 14 days free", primary: true },
  },
  {
    key: "enterprise",
    subtitle: "Self-hosted control plane in your VPC",
    monthlyUsd: null,
    features: [
      "Everything in Team",
      "Self-hosted eltPulse control plane (Docker)",
      "Unlimited gateways & air-gapped metadata",
      "Annual platform license from $24k/yr",
      "SLA-backed uptime commitment",
      "Dedicated onboarding & security review",
      "Custom connector development",
    ],
    cta: {
      href: "mailto:hello@eltpulse.dev?subject=eltPulse%20Enterprise%20—%20self-hosted%20control%20plane",
      label: "Contact enterprise sales",
    },
  },
];

function FeatureCell({ value }: { value: ComparisonCell }) {
  if (typeof value === "boolean") {
    return value ? (
      <Check className="mx-auto h-5 w-5 text-blue-600" />
    ) : (
      <X className="mx-auto h-4 w-4 text-slate-300" />
    );
  }
  return <span className="text-sm font-medium text-slate-700">{value}</span>;
}

export function PricingPageClient() {
  const [billing, setBilling] = useState<BillingInterval>("monthly");
  const plans = TIERS;
  const tierKeys: PricingTierKey[] = ["free", "pro", "team", "enterprise"];

  const dedicatedDisplay = displayMonthlyUsd(PLAN_PRICES_USD.dedicatedCompute.monthly, billing);

  return (
    <div className="bg-white">
      {/* Header — ServicePulse-style light hero */}
      <section className="bg-slate-100 py-20 text-center dark:bg-slate-950">
        <h1 className="text-4xl font-bold text-slate-900 dark:text-white sm:text-5xl">
          Simple, transparent pricing
        </h1>
        <p className="mt-4 text-lg text-slate-600 dark:text-slate-400">Start free. Upgrade when you&apos;re ready.</p>
        <div className="mt-8 inline-flex items-center gap-1 rounded-xl bg-slate-200 p-1 dark:bg-slate-800">
          <button
            type="button"
            onClick={() => setBilling("monthly")}
            className={`rounded-lg px-5 py-2 text-sm font-medium transition ${
              billing === "monthly"
                ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Monthly
          </button>
          <button
            type="button"
            onClick={() => setBilling("annual")}
            className={`flex items-center gap-2 rounded-lg px-5 py-2 text-sm font-medium transition ${
              billing === "annual"
                ? "bg-white text-slate-900 dark:bg-slate-950 dark:text-white"
                : "text-slate-600 hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
            }`}
          >
            Annual
            <span className="rounded-full bg-green-500 px-2 py-0.5 text-xs font-semibold text-white">
              Save 2 months
            </span>
          </button>
        </div>
      </section>

      {/* Plan cards */}
      <section className="mx-auto max-w-7xl px-6 py-20">
        <div className="grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {plans.map((plan) => {
            const price =
              plan.monthlyUsd !== null && plan.monthlyUsd > 0
                ? displayMonthlyUsd(plan.monthlyUsd, billing)
                : null;

            return (
              <div
                key={plan.key}
                className={`relative rounded-2xl border p-8 ${
                  plan.highlighted
                    ? "border-blue-600 shadow-lg shadow-blue-100"
                    : "border-slate-200"
                }`}
              >
                {plan.badge ? (
                  <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-4 py-1 text-xs font-semibold text-white">
                    {plan.badge}
                  </div>
                ) : null}

                <h2 className="text-xl font-bold text-slate-900">{PRICING_TIER_LABELS[plan.key]}</h2>
                <p className="mt-1 text-sm text-slate-500">{plan.subtitle}</p>

                <div className="mt-6">
                  {price !== null ? (
                    <div>
                      <span className="text-4xl font-bold text-slate-900">${price}</span>
                      <span className="text-slate-500">/month + usage</span>
                      {billing === "annual" ? (
                        <p className="mt-1 text-xs font-medium text-green-600">
                          billed annually — 2 months free
                        </p>
                      ) : null}
                    </div>
                  ) : plan.monthlyUsd === 0 ? (
                    <div>
                      <span className="text-4xl font-bold text-slate-900">Free</span>
                      <span className="ml-2 text-slate-500">forever</span>
                    </div>
                  ) : (
                    <div>
                      <span className="text-4xl font-bold text-slate-900">Custom</span>
                      {plan.key === "enterprise" ? (
                        <p className="mt-1 text-sm text-slate-500">Platform license from $24k/yr</p>
                      ) : null}
                    </div>
                  )}
                </div>

                <Link
                  href={plan.cta.href}
                  className={`mt-6 block rounded-lg px-4 py-3 text-center text-sm font-semibold transition ${
                    plan.cta.primary || plan.highlighted
                      ? "bg-blue-600 text-white hover:bg-blue-500"
                      : "border border-slate-200 text-slate-700 hover:border-slate-400"
                  }`}
                >
                  {plan.cta.label}
                </Link>

                <ul className="mt-6 space-y-3">
                  {plan.features.map((feature) => (
                    <li key={feature} className="flex items-start gap-2 text-sm">
                      <Check className="mt-0.5 h-4 w-4 shrink-0 text-blue-600" />
                      <span className="text-slate-600">{feature}</span>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>

        <p className="mt-8 text-center text-sm text-slate-600">
          <strong className="font-medium text-slate-800">Dedicated managed compute</strong> (Team add-on):{" "}
          {formatUsd(dedicatedDisplay)}/month platform fee + metered infrastructure
          {billing === "annual" ? " (billed annually)" : ""}.{" "}
          <Link href="/sign-up" className="font-medium text-blue-600 hover:underline">
            Available after Team signup
          </Link>
          .
        </p>
      </section>

      {/* Feature comparison table */}
      <section className="mx-auto max-w-6xl px-6 pb-20">
        <h2 className="mb-8 text-center text-2xl font-bold text-slate-900">Full comparison</h2>
        <div className="overflow-x-auto rounded-xl border border-slate-200">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="px-6 py-4 text-left text-sm font-semibold text-slate-700">Feature</th>
                {plans.map((p) => (
                  <th
                    key={p.key}
                    className="px-6 py-4 text-center text-sm font-semibold text-slate-700"
                  >
                    {PRICING_TIER_LABELS[p.key]}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {PRICING_COMPARISON_SECTIONS.reduce<{
                section: string | null;
                rowIndex: number;
                rows: ReactNode[];
              }>(
                (acc, section) => {
                  const colSpan = tierKeys.length + 1;
                  if (section.title !== acc.section) {
                    acc.section = section.title;
                    acc.rowIndex = 0;
                    acc.rows.push(
                      <tr key={`section-${section.title}`}>
                        <td
                          colSpan={colSpan}
                          className="bg-slate-100 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500"
                        >
                          {section.title}
                        </td>
                      </tr>
                    );
                  }
                  for (const row of section.rows) {
                    const rowBg = acc.rowIndex % 2 === 0 ? "bg-white" : "bg-slate-50/50";
                    acc.rowIndex++;
                    acc.rows.push(
                      <tr key={row.label} className={rowBg}>
                        <td className="px-6 py-3 text-sm text-slate-700">{row.label}</td>
                        {tierKeys.map((k) => (
                          <td key={k} className="px-6 py-3 text-center">
                            <FeatureCell value={row[k]} />
                          </td>
                        ))}
                      </tr>
                    );
                  }
                  return acc;
                },
                { section: null, rowIndex: 0, rows: [] }
              ).rows}
            </tbody>
          </table>
        </div>
      </section>

      {/* FAQ */}
      <section className="border-t border-slate-100 bg-slate-50 py-20">
        <div className="mx-auto max-w-3xl px-6">
          <h2 className="mb-10 text-center text-2xl font-bold text-slate-900">
            Frequently asked questions
          </h2>
          <div className="space-y-6">
            {PRICING_FAQ.map((item) => (
              <div key={item.q} className="rounded-lg border border-slate-200 bg-white p-6">
                <h3 className="font-semibold text-slate-900">{item.q}</h3>
                <p className="mt-2 text-sm text-slate-600">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-blue-600 py-16 text-center">
        <h2 className="text-2xl font-bold text-white">Ready to ship your first pipeline?</h2>
        <p className="mt-2 text-blue-200">
          Connect a source, pick a warehouse, and run — managed compute included. No gateway required.
        </p>
        <Link
          href="/sign-up"
          className="mt-6 inline-block rounded-lg bg-white px-8 py-3 text-sm font-semibold text-blue-600 transition hover:bg-blue-50"
        >
          Start free today →
        </Link>
      </section>
    </div>
  );
}
