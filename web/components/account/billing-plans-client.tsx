"use client";

import { useState } from "react";
import Link from "next/link";
import {
  displayMonthlyUsd,
  formatUsd,
  PLAN_PRICES_USD,
  type BillingInterval,
} from "@/lib/billing/plan-pricing";
import { DEDICATED_COMPUTE_MARKUP_PERCENT } from "@/lib/billing/dedicated-compute-pricing";
import { BillingDedicatedComputeButton } from "@/components/account/billing-dedicated-compute-button";
import { BillingIntervalToggle } from "@/components/account/billing-interval-toggle";
import { BillingPortalButton } from "@/components/account/billing-portal-button";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";

export function BillingPlansClient({
  tier,
  hasStripeCustomer,
  hasOrg,
  dedicatedSubscribed,
}: {
  tier: string;
  hasStripeCustomer: boolean;
  hasOrg: boolean;
  dedicatedSubscribed: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const proDisplay = displayMonthlyUsd(PLAN_PRICES_USD.pro.monthly, interval);
  const teamDisplay = displayMonthlyUsd(PLAN_PRICES_USD.team.monthly, interval);
  const dedicatedDisplay = displayMonthlyUsd(PLAN_PRICES_USD.dedicatedCompute.monthly, interval);

  return (
    <>
      {tier === "free" ? (
        <div className="mt-4 space-y-4">
          <BillingIntervalToggle value={interval} onChange={setInterval} />
          <div className="flex flex-wrap gap-3">
            <BillingUpgradeButton
              tier="pro"
              interval={interval}
              label={`Upgrade to Pro — ${formatUsd(proDisplay)}/mo`}
              className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            />
            <BillingUpgradeButton
              tier="team"
              interval={interval}
              label={`Upgrade to Team — ${formatUsd(teamDisplay)}/mo`}
              className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-800 hover:border-slate-400 dark:border-slate-600 dark:text-slate-200"
            />
          </div>
          {interval === "annual" ? (
            <p className="text-xs text-green-600 dark:text-green-400">billed annually — 2 months free</p>
          ) : null}
        </div>
      ) : null}

      {hasStripeCustomer ? (
        <BillingPortalButton className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" />
      ) : null}

      <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50/60 p-4 dark:border-blue-900/50 dark:bg-blue-950/20">
        <h3 className="text-sm font-semibold text-blue-900 dark:text-blue-100">Dedicated managed compute</h3>
        <p className="mt-1 text-sm text-blue-900/80 dark:text-blue-200/80">
          {formatUsd(dedicatedDisplay)}/mo platform fee + metered compute (cost-plus{" "}
          {DEDICATED_COMPUTE_MARKUP_PERCENT}%)
          {interval === "annual" ? " — billed annually" : ""}.
        </p>
        {dedicatedSubscribed ? (
          <p className="mt-2 text-xs font-medium text-emerald-800 dark:text-emerald-200">Active on your organization</p>
        ) : tier === "team" && hasOrg ? (
          <div className="mt-3 space-y-2">
            <BillingIntervalToggle value={interval} onChange={setInterval} />
            <BillingDedicatedComputeButton
              interval={interval}
              label={`Add dedicated compute — ${formatUsd(dedicatedDisplay)}/mo + usage`}
              className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-blue-500 disabled:opacity-50"
            />
          </div>
        ) : (
          <p className="mt-3 text-xs text-blue-800/70 dark:text-blue-200/70">
            Requires Team plan.{" "}
            <Link href="/team" className="font-medium underline">
              Manage on Team page
            </Link>
            .
          </p>
        )}
      </div>
    </>
  );
}
