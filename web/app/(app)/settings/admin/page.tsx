import type { Metadata } from "next";
import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import { resolveUserPlanTier } from "@/lib/plans/tier-features";
import { DevTierSwitcher } from "@/app/(app)/billing/dev-tier-switcher";

export const metadata: Metadata = { title: "Admin Tools" };
export const revalidate = 0;

export default async function PlatformAdminPage() {
  const user = await requireDbUser();
  const tier = await resolveUserPlanTier(user.id);

  return (
    <div className="space-y-8">
      <section className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
        <h2 className="mb-1 text-sm font-semibold text-amber-900 dark:text-amber-200">
          Plan tier (dev / super admin)
        </h2>
        <p className="mb-4 text-xs text-amber-800/90 dark:text-amber-300/90">
          Same control as Billing — sets subscription tier in the database and bypasses Stripe. Use Billing for real
          checkout and invoices.
        </p>
        <DevTierSwitcher currentTier={tier} />
        <p className="mt-3 text-xs text-amber-800/80 dark:text-amber-400/90">
          <Link
            href="/account/billing"
            className="font-medium text-amber-900 underline underline-offset-2 dark:text-amber-200"
          >
            Open Billing
          </Link>{" "}
          for Stripe, usage, and upgrades.
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-slate-50 p-5 text-sm text-slate-600 dark:border-slate-800 dark:bg-slate-900/50 dark:text-slate-400">
        <p className="font-medium text-slate-800 dark:text-slate-200">Alert rules vs notifications</p>
        <ul className="mt-2 list-inside list-disc space-y-1 text-xs">
          <li>Alert rules on Metrics are available on all tiers; they evaluate on a schedule.</li>
          <li>
            Email, Teams, Discord, PagerDuty, and custom webhook channels require Pro+ (Slack requires Team) under
            Account → Notifications, with <strong>Observability alert fired</strong> enabled.
          </li>
          <li>
            Rules can also POST to your account-level <strong>Runs webhook</strong> (Webhooks page) when notify webhook
            is on — separate from notification channels.
          </li>
        </ul>
      </section>
    </div>
  );
}
