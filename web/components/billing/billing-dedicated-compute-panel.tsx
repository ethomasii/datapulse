"use client";

import Link from "next/link";
import { useState } from "react";
import type { PlanTier } from "@prisma/client";
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

export function BillingDedicatedComputePanel({
  tier,
  hasOrg,
  dedicatedSubscribed,
}: {
  tier: PlanTier;
  hasOrg: boolean;
  dedicatedSubscribed: boolean;
}) {
  const [interval, setInterval] = useState<BillingInterval>("monthly");
  const dedicatedDisplay = displayMonthlyUsd(PLAN_PRICES_USD.dedicatedCompute.monthly, interval);

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
      <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Dedicated managed compute</h3>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Shared managed compute is included on all plans.{" "}
        <strong className="font-medium text-slate-800 dark:text-slate-200">Dedicated compute</strong> is a Team
        add-on — an isolated worker queue so other organizations never share or throttle your runs.
      </p>
      <p className="mt-2 text-xs text-slate-500 dark:text-slate-400">
        {formatUsd(dedicatedDisplay)}/mo platform fee + metered compute (cost-plus {DEDICATED_COMPUTE_MARKUP_PERCENT}%)
        {interval === "annual" ? " — billed annually" : ""}.
      </p>
      {dedicatedSubscribed ? (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            Active on your organization
          </span>
          <BillingPortalButton className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" />
        </div>
      ) : tier === "team" && hasOrg ? (
        <div className="mt-4 space-y-2">
          <BillingIntervalToggle value={interval} onChange={setInterval} />
          <BillingDedicatedComputeButton
            interval={interval}
            label={`Add dedicated compute — ${formatUsd(dedicatedDisplay)}/mo + usage`}
            className="rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
          />
        </div>
      ) : (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          Requires Team plan.{" "}
          <Link href="/account/team" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Manage on Team page
          </Link>
          .
        </p>
      )}
    </div>
  );
}
