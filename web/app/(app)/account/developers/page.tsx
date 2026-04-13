import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Developers",
};

export default function DevelopersPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">API keys</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Personal and service tokens for the eltPulse HTTP API (pipeline CRUD, triggers) will be issued here with
          scopes and rotation — similar to developer settings in other SaaS products.
        </p>
        <div className="mt-6 rounded-lg border border-dashed border-slate-200 py-10 text-center text-sm text-slate-500 dark:border-slate-700">
          API keys are not enabled for this environment yet.
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Webhooks</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Optional <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">run webhooks</Link>{" "}
          (account default and per-pipeline overrides) are configured on the Runs page. Signing secrets, richer event
          types, and delivery logs may land here later.
        </p>
      </section>
    </div>
  );
}
