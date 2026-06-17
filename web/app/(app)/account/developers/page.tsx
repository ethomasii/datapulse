import { DevelopersClient } from "@/components/account/developers-client";
import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Developers",
};

export default function DevelopersPage() {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">API keys</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Personal tokens for the eltPulse HTTP API — pipeline CRUD, run triggers, and automation.
        </p>
        <div className="mt-6">
          <DevelopersClient />
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Webhooks</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Optional{" "}
          <Link href="/webhooks" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            run webhooks
          </Link>{" "}
          fire when pipelines finish. Incoming trigger URLs are on the Webhooks page.
        </p>
      </section>
    </div>
  );
}
