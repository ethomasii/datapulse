import Link from "next/link";
import { requireDbUser } from "@/lib/auth/server";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Billing",
};

export default async function BillingPage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const status = user.subscription?.status ?? "active";

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
          Stripe customer and subscription IDs sync via webhooks when <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">STRIPE_*</code>{" "}
          env vars are configured. Upgrade and payment method management will surface here.
        </p>
        <Link
          href="/pricing"
          className="mt-4 inline-flex text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          View pricing →
        </Link>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Compute &amp; execution</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          For <strong className="font-medium text-slate-800 dark:text-slate-200">hosted compute</strong>, we plan a
          transparent <strong className="font-medium text-slate-800 dark:text-slate-200">cost-plus</strong> model: you
          pay our underlying infrastructure cost for the work we run on your behalf, plus a{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">15% markup</strong>. Pass-through costs and
          margin stay explicit so you can reason about the bill — no bundled “mystery” compute.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          If you prefer not to pay for managed execution, you can{" "}
          <strong className="font-medium text-slate-800 dark:text-slate-200">run your own agent</strong> (in your
          environment) and use DataPulse as the <strong className="font-medium text-slate-800 dark:text-slate-200">control plane</strong>{" "}
          — pipelines, policies, and orchestration UI — without us charging for compute you provide. A first-party,
          fully managed execution agent in our stack is <strong className="font-medium text-slate-800 dark:text-slate-200">on the roadmap</strong>;
          many teams will start with bring-your-own execution.
        </p>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          Meters, list prices, and contract terms will be confirmed before any usage-based compute charges go live.
        </p>
      </section>

      <section className="rounded-xl border border-dashed border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/40">
        <h3 className="text-sm font-semibold text-slate-800 dark:text-slate-200">Invoices &amp; payment method</h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Invoice history, PDF downloads, and card/bank updates will appear here once the Stripe Customer Portal and
          webhooks are wired for your deployment.
        </p>
      </section>
    </div>
  );
}
