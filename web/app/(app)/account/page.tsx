import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Profile",
};

export default async function AccountProfilePage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const status = user.subscription?.status ?? "active";

  return (
    <>
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
    </>
  );
}
