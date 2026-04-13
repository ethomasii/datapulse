import Link from "next/link";
import { BookOpen, CalendarClock, LifeBuoy, Mail } from "lucide-react";

export default function HelpPage() {
  return (
    <div className="w-full min-w-0 max-w-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-sky-900 dark:border-sky-900/50 dark:bg-sky-950/40 dark:text-sky-100">
        <LifeBuoy className="h-3.5 w-3.5" aria-hidden />
        Help center (preview)
      </div>
      <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">Help</h1>
      <p className="mt-3 text-lg text-slate-600 dark:text-slate-300">
        In-app help will aggregate runbooks, FAQs, and support status. For now, use the resources below — the same
        pattern as shipping a real help hub before chat is wired.
      </p>

      <ul className="mt-10 space-y-4">
        <li>
          <Link
            href="/orchestration"
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-800"
          >
            <CalendarClock className="mt-0.5 h-6 w-6 shrink-0 text-amber-600" aria-hidden />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Orchestration</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Schedules and eltPulse sensors in our product, plus portable definitions if you prefer Airflow, Prefect,
                or another engine — choice without lock-in.
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/docs"
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-800"
          >
            <BookOpen className="mt-0.5 h-6 w-6 shrink-0 text-sky-600" aria-hidden />
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Documentation</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Public guides: getting started, pipelines, integrations, security — no sign-in required.
              </p>
            </div>
          </Link>
        </li>
        <li>
          <Link
            href="/roadmap"
            className="flex items-start gap-4 rounded-2xl border border-slate-200 bg-white p-5 transition hover:border-sky-300 dark:border-slate-800 dark:bg-slate-900/60 dark:hover:border-sky-800"
          >
            <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded bg-violet-100 text-xs font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              R
            </span>
            <div>
              <p className="font-semibold text-slate-900 dark:text-white">Roadmap</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                What is shipped, in progress, and planned — with honest status labels.
              </p>
            </div>
          </Link>
        </li>
        <li className="flex items-start gap-4 rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-5 dark:border-slate-700 dark:bg-slate-900/40">
          <Mail className="mt-0.5 h-6 w-6 shrink-0 text-slate-500" aria-hidden />
          <div>
            <p className="font-semibold text-slate-900 dark:text-white">Contact support</p>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Dedicated support channels (in-app messaging, email) will appear here by tier. Until then, use your
              existing eltPulse contact path.
            </p>
          </div>
        </li>
      </ul>

      <p className="mt-10 text-sm">
        <Link href="/dashboard" className="text-sky-600 hover:underline dark:text-sky-400">
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
