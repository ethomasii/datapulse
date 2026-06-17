import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { PLAN_PIPELINE_LIMITS, countUserPipelines } from "@/lib/plans/limits";
import { BillingPortalButton } from "@/components/account/billing-portal-button";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";
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
  const pipelineLimit = PLAN_PIPELINE_LIMITS[tier];
  const usageMeterEnabled = Boolean(process.env.STRIPE_USAGE_METER_EVENT_NAME);

  return (
    <div className="space-y-6">
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
          </Link>
          .
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          {tier === "free" ? (
            <>
              <BillingUpgradeButton
                tier="pro"
                label="Upgrade to Pro — 14-day trial"
                className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              />
              <BillingUpgradeButton
                tier="team"
                label="Upgrade to Team"
                className="rounded-lg border border-violet-300 px-4 py-2 text-sm font-semibold text-violet-800 hover:bg-violet-50 dark:border-violet-700 dark:text-violet-200 dark:hover:bg-violet-950"
              />
            </>
          ) : null}
          {hasStripeCustomer ? (
            <BillingPortalButton className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800" />
          ) : null}
        </div>
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
          Hosted compute uses a transparent <strong className="font-medium text-slate-800 dark:text-slate-200">cost-plus</strong>{" "}
          model: underlying infrastructure cost plus a 15% markup. Bring-your-own gateway or self-hosted execution avoids
          managed compute charges.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Set execution preference under{" "}
          <Link href="/gateway" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Gateway
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
