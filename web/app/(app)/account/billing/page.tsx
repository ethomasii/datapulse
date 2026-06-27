import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";
import { getMonthlyRowsSynced } from "@/lib/billing/report-usage";
import { getDedicatedComputeBilling } from "@/lib/billing/dedicated-compute-subscription";
import {
  formatInvoiceCurrency,
  formatInvoiceDate,
  listStripeInvoices,
  mockInvoicePreview,
} from "@/lib/billing/invoices";
import { getStripe } from "@/lib/billing/stripe";
import { PLAN_PIPELINE_LIMITS, countUserPipelines } from "@/lib/plans/limits";
import { getPlanUsageSummary } from "@/lib/plans/usage-summary";
import { getEffectiveTier } from "@/lib/plans/plan-enforcement";
import { ManageBillingButton } from "@/components/billing/manage-billing-button";
import { PlanUpgradeCards } from "@/components/billing/plan-upgrade-cards";
import { UsageMeter } from "@/components/billing/usage-meter";
import { DevTierSwitcher } from "@/app/(app)/billing/dev-tier-switcher";
import { BillingDedicatedComputePanel } from "@/components/billing/billing-dedicated-compute-panel";
import { db } from "@/lib/db/client";
import type { Metadata } from "next";
import { AlertTriangle, CheckCircle, Download, Receipt } from "lucide-react";

export const metadata: Metadata = {
  title: "Billing",
};

export const revalidate = 0;

function formatSubscriptionDate(d: Date | null | undefined): string | null {
  if (!d) return null;
  return d.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default async function BillingPage() {
  const user = await requireDbUser();
  const tier = getEffectiveTier(user.subscription);
  const status = user.subscription?.status ?? "active";
  const stripeCustomerId = user.subscription?.stripeCustomerId ?? null;
  const stripeConfigured = Boolean(getStripe());
  const usageMeterEnabled = Boolean(process.env.STRIPE_USAGE_METER_EVENT_NAME);
  const isSuperAdmin = isSuperAdminClerkId(user.clerkId);

  const [pipelineCount, rowsThisMonth, apiKeyCount, personalGatewayCount, org] = await Promise.all([
    countUserPipelines(user.id),
    getMonthlyRowsSynced(user.id),
    db.workspaceApiKey.count({ where: { userId: user.id, revokedAt: null } }),
    db.agentToken.count({ where: { userId: user.id, organizationId: null, revokedAt: null } }),
    db.organization.findUnique({ where: { ownerUserId: user.id }, select: { id: true } }),
  ]);

  const usage = getPlanUsageSummary(user.subscription, {
    pipelines: pipelineCount,
    apiKeys: apiKeyCount,
    personalGateways: personalGatewayCount,
    rowsSyncedThisMonth: rowsThisMonth,
  });

  const dedicatedBilling = org ? await getDedicatedComputeBilling(org.id) : null;

  const rawInvoices = stripeCustomerId ? await listStripeInvoices(stripeCustomerId) : [];
  const usingMockInvoices = rawInvoices.length === 0 && isSuperAdmin && !stripeCustomerId;
  const invoices = usingMockInvoices ? mockInvoicePreview() : rawInvoices;

  const hasPaymentProblem =
    !usingMockInvoices &&
    (status === "past_due" || invoices.some((inv) => inv.status === "open" && inv.amountDue > 0));

  const renews = formatSubscriptionDate(user.subscription?.currentPeriodEnd);
  const pipelineLimit = PLAN_PIPELINE_LIMITS[tier];
  const approachingLimits =
    tier === "free" &&
    (usage.pipelines.percentage >= 80 ||
      usage.apiKeys.percentage >= 80 ||
      usage.personalGateways.percentage >= 80);

  return (
    <div className="space-y-6">
      {!stripeConfigured ? (
        <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
          Stripe is not configured in this environment (<code className="text-xs">STRIPE_SECRET_KEY</code>). Plan
          tiers and usage still apply — checkout and invoices activate when Stripe price IDs are set on Vercel.
        </div>
      ) : null}

      {hasPaymentProblem && stripeCustomerId ? (
        <div className="flex items-start gap-3 rounded-xl border border-red-200 bg-red-50 px-5 py-4 dark:border-red-900/50 dark:bg-red-950/20">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-red-500" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-red-800 dark:text-red-300">Payment issue — action required</p>
            <p className="mt-0.5 text-xs text-red-700 dark:text-red-400">
              We couldn&apos;t collect payment for your subscription. Update your payment method to avoid service
              interruption.
            </p>
          </div>
          <ManageBillingButton className="inline-flex items-center gap-2 rounded-lg border border-red-300 bg-white px-3 py-1.5 text-sm font-medium text-red-800 hover:bg-red-50 dark:border-red-800 dark:bg-red-950 dark:text-red-200" />
        </div>
      ) : null}

      {/* Current plan */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
              Current plan
            </p>
            <h2 className="mt-1 text-2xl font-bold text-slate-900 dark:text-slate-100">{usage.plan.name}</h2>
            <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{usage.plan.description}</p>
            {status === "trialing" ? (
              <span className="mt-2 inline-block rounded-full bg-sky-100 px-2.5 py-0.5 text-xs font-medium text-sky-800 dark:bg-sky-900/40 dark:text-sky-200">
                Free trial
              </span>
            ) : null}
            {status === "past_due" ? (
              <span className="mt-2 inline-block rounded-full bg-red-100 px-2.5 py-0.5 text-xs font-medium text-red-700 dark:bg-red-900/40 dark:text-red-300">
                Past due
              </span>
            ) : null}
            {status === "active" && tier !== "free" ? (
              <span className="mt-2 inline-block rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
                Active
              </span>
            ) : null}
          </div>
          {usage.plan.monthlyPriceUsd ? (
            <p className="text-lg font-semibold text-slate-700 dark:text-slate-200">
              ${usage.plan.monthlyPriceUsd}
              <span className="text-sm font-normal text-slate-500">/month</span>
            </p>
          ) : null}
        </div>
        {renews && status !== "past_due" ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">Renews {renews}</p>
        ) : null}
        {stripeCustomerId ? (
          <div className="mt-4">
            <ManageBillingButton className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-300" />
          </div>
        ) : null}
      </div>

      {/* Usage */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Usage</h3>
        <div className="space-y-4">
          <UsageMeter
            label="Saved pipelines"
            current={usage.pipelines.current}
            max={usage.pipelines.max}
            percentage={usage.pipelines.percentage}
          />
          <UsageMeter
            label="API keys"
            current={usage.apiKeys.current}
            max={usage.apiKeys.max}
            percentage={usage.apiKeys.percentage}
          />
          <UsageMeter
            label="Personal gateways"
            current={usage.personalGateways.current}
            max={usage.personalGateways.max}
            percentage={usage.personalGateways.percentage}
          />
          <UsageMeter
            label="Rows synced this month"
            current={usage.rowsSyncedThisMonth}
            max={null}
            percentage={0}
            sublabel={
              usageMeterEnabled
                ? "Reported to Stripe for usage-based billing on Pro and Team."
                : "Usage metering activates when STRIPE_USAGE_METER_EVENT_NAME is configured."
            }
          />
          <p className="text-sm text-slate-600 dark:text-slate-400">
            Run history retention:{" "}
            <strong className="font-medium text-slate-800 dark:text-slate-200">
              {usage.runHistoryDays} days
            </strong>
          </p>
        </div>
        {approachingLimits ? (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            You&apos;re approaching your Free plan limits
            {pipelineLimit !== null ? ` (${pipelineCount}/${pipelineLimit} pipelines)` : ""}.{" "}
            <Link href="#upgrade" className="font-semibold underline">
              Upgrade to Pro
            </Link>{" "}
            for unlimited pipelines, webhooks, and 90-day run history.
          </div>
        ) : null}
      </div>

      {/* Plan features */}
      <div className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
        <h3 className="mb-4 text-sm font-semibold text-slate-700 dark:text-slate-300">Your plan includes</h3>
        <ul className="space-y-2">
          {usage.plan.features.map((feature) => (
            <li key={feature} className="flex items-start gap-2 text-sm text-slate-600 dark:text-slate-400">
              <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-emerald-500" />
              {feature}
            </li>
          ))}
        </ul>
      </div>

      {/* Upgrade */}
      {tier !== "team" ? (
        <div id="upgrade" className="rounded-xl border border-slate-200 bg-white p-6 dark:border-slate-700 dark:bg-slate-900">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Upgrade your plan</h3>
            <Link href="/pricing" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
              Compare all plans →
            </Link>
          </div>
          <PlanUpgradeCards currentTier={tier} />
        </div>
      ) : null}

      {/* Dedicated compute */}
      <BillingDedicatedComputePanel
        tier={tier}
        hasOrg={Boolean(org)}
        dedicatedSubscribed={Boolean(dedicatedBilling?.subscribed)}
      />

      {/* Invoice history */}
      {invoices.length > 0 ? (
        <div className="overflow-hidden rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-slate-200 px-6 py-4 dark:border-slate-700">
            <Receipt className="h-4 w-4 text-slate-400" />
            <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-300">Invoice history</h3>
            {usingMockInvoices ? (
              <span className="ml-auto inline-flex items-center gap-1 rounded-full border border-dashed border-amber-300 bg-amber-50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:border-amber-700 dark:bg-amber-950/30 dark:text-amber-400">
                Preview data — no Stripe customer
              </span>
            ) : null}
          </div>
          <div className="divide-y divide-slate-100 dark:divide-slate-800">
            {invoices.map((inv) => {
              const isProblem = inv.status === "open" && inv.amountDue > 0;
              const isVoid = inv.status === "void";
              return (
                <div key={inv.id} className="flex flex-wrap items-center gap-4 px-6 py-3">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-slate-800 dark:text-slate-200">
                      {formatInvoiceDate(inv.created)}
                      {inv.number ? (
                        <span className="ml-2 text-xs font-normal text-slate-400">{inv.number}</span>
                      ) : null}
                    </p>
                    <p className="text-xs text-slate-400 dark:text-slate-500">
                      {formatInvoiceDate(inv.periodStart)} – {formatInvoiceDate(inv.periodEnd)}
                    </p>
                  </div>
                  <span className="shrink-0 text-sm font-medium text-slate-700 dark:text-slate-300">
                    {formatInvoiceCurrency(
                      inv.status === "paid" ? inv.amountPaid : inv.amountDue,
                      inv.currency
                    )}
                  </span>
                  <span
                    className={`inline-flex shrink-0 items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                      inv.status === "paid"
                        ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-400"
                        : isProblem
                          ? "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400"
                          : isVoid
                            ? "bg-slate-100 text-slate-500 dark:bg-slate-800 dark:text-slate-400"
                            : "bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-400"
                    }`}
                  >
                    {isProblem ? "Payment failed" : inv.status ?? "unknown"}
                  </span>
                  {inv.invoicePdf ? (
                    <a
                      href={inv.invoicePdf}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-slate-400 transition hover:text-sky-600 dark:hover:text-sky-400"
                      title="Download PDF"
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  ) : null}
                  {inv.hostedInvoiceUrl ? (
                    <a
                      href={inv.hostedInvoiceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-sky-600 hover:underline dark:text-sky-400"
                    >
                      View
                    </a>
                  ) : null}
                </div>
              );
            })}
          </div>
        </div>
      ) : stripeCustomerId ? (
        <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50 px-6 py-8 text-center text-sm text-slate-500 dark:border-slate-700 dark:bg-slate-900/40 dark:text-slate-400">
          No invoices yet — they appear here after your first Pro or Team billing cycle.
        </div>
      ) : null}

      {isSuperAdmin ? <DevTierSwitcher currentTier={tier} /> : null}
    </div>
  );
}
