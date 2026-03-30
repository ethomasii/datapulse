import { requireDbUser } from "@/lib/auth/server";

export default async function DashboardPage() {
  const user = await requireDbUser();
  const tier = user.subscription?.tier ?? "free";
  const status = user.subscription?.status ?? "active";

  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Dashboard</h1>
      <p className="mt-2 text-slate-600 dark:text-slate-300">
        Signed in as <span className="font-medium text-slate-800 dark:text-slate-200">{user.email}</span>
      </p>
      <dl className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Plan</dt>
          <dd className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-white">{tier}</dd>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-800 dark:bg-slate-900">
          <dt className="text-xs font-medium uppercase tracking-wide text-slate-500">Subscription</dt>
          <dd className="mt-1 text-lg font-semibold capitalize text-slate-900 dark:text-white">{status}</dd>
        </div>
      </dl>
      <p className="mt-8 text-sm text-slate-500 dark:text-slate-400">
        Stripe webhooks update plan and status when you connect price IDs in the environment. Anthropic and
        Resend clients are scaffolded under <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">lib/</code>{" "}
        for assistant and transactional email features.
      </p>
    </div>
  );
}
