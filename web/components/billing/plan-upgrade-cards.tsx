"use client";

import { useState } from "react";
import { Check, Loader2 } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { PLANS } from "@/lib/plans/config";
import { displayMonthlyUsd, formatUsd, PLAN_PRICES_USD, type BillingInterval } from "@/lib/billing/plan-pricing";
import { BillingIntervalToggle } from "@/components/account/billing-interval-toggle";

const TIER_ORDER: Record<PlanTier, number> = { free: 0, pro: 1, team: 2 };

export function PlanUpgradeCards({ currentTier }: { currentTier: PlanTier }) {
  const [loading, setLoading] = useState<PlanTier | null>(null);
  const [interval, setInterval] = useState<BillingInterval>("monthly");

  const upgradable = (["pro", "team"] as const).filter((t) => TIER_ORDER[t] > TIER_ORDER[currentTier]);

  async function checkout(tier: "pro" | "team") {
    setLoading(tier);
    try {
      const res = await fetch("/api/billing/checkout", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ tier, interval }),
      });
      const data = (await res.json()) as { url?: string; error?: string };
      if (data.url) window.location.href = data.url;
    } finally {
      setLoading(null);
    }
  }

  if (upgradable.length === 0) return null;

  return (
    <div>
      <BillingIntervalToggle value={interval} onChange={setInterval} />
      <div className={`mt-4 grid gap-4 ${upgradable.length > 1 ? "sm:grid-cols-2" : ""}`}>
        {upgradable.map((tier) => {
          const plan = PLANS[tier];
          const monthly = PLAN_PRICES_USD[tier].monthly;
          const display = displayMonthlyUsd(monthly, interval);
          const highlighted = tier === "pro";

          return (
            <div
              key={tier}
              className={`relative rounded-xl border p-5 ${
                highlighted
                  ? "border-sky-300 bg-sky-50 dark:border-sky-700 dark:bg-sky-950/30"
                  : "border-violet-300 bg-violet-50 dark:border-violet-700 dark:bg-violet-950/30"
              }`}
            >
              {highlighted ? (
                <span className="absolute -top-2.5 left-1/2 -translate-x-1/2 whitespace-nowrap rounded-full bg-sky-600 px-3 py-0.5 text-xs font-semibold text-white">
                  Most Popular
                </span>
              ) : null}
              <h4 className="font-bold text-slate-900 dark:text-slate-100">{plan.name}</h4>
              <p className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">
                {formatUsd(display)}
                <span className="text-sm font-normal text-slate-500 dark:text-slate-400">/mo</span>
              </p>
              {interval === "annual" ? (
                <p className="text-xs text-green-600 dark:text-green-400">billed annually — 2 months free</p>
              ) : (
                <p className="text-xs text-slate-500 dark:text-slate-400">14-day free trial</p>
              )}
              <ul className="mt-3 space-y-1.5">
                {plan.features.slice(0, 5).map((f) => (
                  <li key={f} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
                    <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-sky-600" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                type="button"
                onClick={() => void checkout(tier)}
                disabled={loading === tier}
                className={`mt-4 flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-50 ${
                  highlighted ? "bg-sky-600 hover:bg-sky-500" : "bg-violet-600 hover:bg-violet-500"
                }`}
              >
                {loading === tier ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Upgrade to {plan.name}
              </button>
            </div>
          );
        })}
      </div>
    </div>
  );
}
