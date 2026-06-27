import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { getDedicatedComputeBilling } from "@/lib/billing/dedicated-compute-subscription";
import { PLAN_PIPELINE_LIMITS, countUserPipelines } from "@/lib/plans/limits";
import { BillingPlansClient } from "@/components/account/billing-plans-client";
import { DevTierSwitcher } from "@/app/(app)/billing/dev-tier-switcher";
import { db } from "@/lib/db/client";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const status = user.subscription?.status ?? "active";
  const hasStripeCustomer = Boolean(user.subscription?.stripeCustomerId);
  const [pipelineCount, rowsThisMonth] = await Promise.all([
    countUserPipelines(user.id),
    getMonthlyRowsSynced(user.id),
  ]);
  const org = await db.organization.findUnique({
    where: { ownerUserId: user.id },
    select: { id: true },
  });
  const dedicatedBilling = org ? await getDedicatedComputeBilling(org.id) : null;
  const pipelineLimit = PLAN_PIPELINE_LIMITS[tier];
  const usageMeterEnabled = Boolean(process.env.STRIPE_USAGE_METER_EVENT_NAME);
  const isSuperAdmin = isSuperAdminClerkId(user.clerkId);

  return (
    <div className="space-y-6">
      {isSuperAdmin ? <DevTierSwitcher currentTier={tier} /> : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Subscription</h2>
        <dl className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</dt>
            <dd className="mt-1 text-xl font-semibold capitalize text-slate-900 dark:text-white">{tier}</dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Status</dt>
            <dd className="mt-1 text-xl font-semibold capitalize text-slate-900 dark:text-white">{status}</dd>
          </div>
        </dl>
        <p className="mt-4 text-sm text-slate-600 dark:text-slate-400">
          Stripe syncs your plan automatically.{" "}
          <Link href="/pricing" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            View pricing
          </Link>{" "}
          — toggle monthly or annual (save 2 months).
        </p>
        <BillingPlansClient
          tier={tier}
          hasStripeCustomer={hasStripeCustomer}
          hasOrg={Boolean(org)}
          dedicatedSubscribed={Boolean(dedicatedBilling?.subscribed)}
        />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Usage this month</h2>
        <dl className="mt-4 grid gap-6 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Pipelines</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {pipelineCount}
              {pipelineLimit !== null ? ` / ${pipelineLimit}` : ""}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Rows synced</dt>
            <dd className="mt-1 text-xl font-semibold text-slate-900 dark:text-white">
              {rowsThisMonth.toLocaleString()}
            </dd>
          </div>
        </dl>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          {usageMeterEnabled
            ? "Row volume is reported to Stripe for usage-based billing on Pro and Team plans."
            : "Usage meters activate when STRIPE_USAGE_METER_EVENT_NAME is configured in your deployment."}
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Compute &amp; execution</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Shared managed compute is included on all plans. Dedicated compute (Team add-on) is configured above or on
          the{" "}
          <Link href="/account/team" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Team
          </Link>{" "}
          page. Gateway preference:{" "}
          <Link href="/gateway" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Gateway
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
