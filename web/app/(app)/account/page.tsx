import Link from "next/link";
import { CreditCard, Bell, Users, Code2, Shield } from "lucide-react";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";
import type { Metadata } from "next";
import { RelatedLinks } from "@/components/ui/related-links";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function AccountProfilePage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const status = user.subscription?.status ?? "active";
  const superAdmin = isSuperAdminClerkId(user.clerkId);

  return (
    <>
      {superAdmin && (
        <section className="mb-6 rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-5 dark:border-amber-700 dark:bg-amber-950/30">
          <div className="mb-2 flex items-center gap-2">
            <Shield className="h-5 w-5 text-amber-600 dark:text-amber-400" />
            <h2 className="text-sm font-semibold text-amber-900 dark:text-amber-200">Platform admin</h2>
          </div>
          <p className="mb-3 text-xs text-amber-800/90 dark:text-amber-300/90">
            Tier switcher and internal shortcuts — same as ServicePulse Admin tools.
          </p>
          <Link
            href="/settings/admin"
            className="inline-flex items-center gap-2 rounded-lg bg-amber-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-amber-500"
          >
            Open Admin tools
          </Link>
        </section>
      )}

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Profile</h2>
        <dl className="mt-4 space-y-3">
          <div>
            <dt className="text-xs text-slate-500">Email</dt>
            <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">{user.email || "—"}</dd>
          </div>
          {user.name && (
            <div>
              <dt className="text-xs text-slate-500">Name</dt>
              <dd className="mt-0.5 font-medium text-slate-900 dark:text-white">{user.name}</dd>
            </div>
          )}
        </dl>
        <p className="mt-4 text-xs text-slate-500">Name and avatar are managed in your sign-in profile.</p>
      </section>

      <section className="mt-6 rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500">Plan snapshot</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          You are on the <span className="font-semibold capitalize text-slate-900 dark:text-white">{tier}</span> plan
          ({status}). Full invoices and payment methods live under{" "}
          <Link href="/account/billing" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Billing
          </Link>
          .
        </p>
      </section>

      <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
        Pipeline definitions stay under{" "}
        <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Pipelines
        </Link>
        .
      </p>

      <div className="mt-8">
        <RelatedLinks links={[
          { href: "/account/billing", icon: CreditCard, label: "Billing", desc: "Invoices, payment methods, and plan management" },
          { href: "/account/notifications", icon: Bell, label: "Notifications", desc: "Configure email and channel alert preferences" },
          { href: "/account/developers", icon: Code2, label: "Developers", desc: "API tokens, webhook secrets, and audit log" },
          { href: "/account/team", icon: Users, label: "Team", desc: "Invite members and manage organization access" },
        ]} />
      </div>
    </>
  );
}
