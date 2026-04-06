import Link from "next/link";
import type { ReactNode } from "react";
import { Construction, Sparkles } from "lucide-react";

export type FocusArea = {
  title: string;
  bullets: string[];
};

type Props = {
  title: string;
  /** Short label above the title, e.g. "Product · Execution" */
  eyebrow?: string;
  summary: string;
  focusAreas: FocusArea[];
  /** What users can do today while this ships */
  expectations: ReactNode[];
  /** e.g. "Targeting 2026" */
  eta?: string;
  /** Primary CTAs (e.g. links to Pipelines) — rendered after the summary */
  actions?: ReactNode;
  children?: ReactNode;
};

export function UpcomingFeaturePage({
  title,
  eyebrow = "On the roadmap",
  summary,
  focusAreas,
  expectations,
  eta,
  actions,
  children,
}: Props) {
  return (
    <div className="mx-auto max-w-2xl">
      <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/40 dark:text-amber-100">
        <Construction className="h-3.5 w-3.5" aria-hidden />
        In development
      </div>
      {eyebrow && (
        <p className="mt-4 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
          {eyebrow}
        </p>
      )}
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900 dark:text-white">{title}</h1>
      <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-300">{summary}</p>
      {eta && (
        <p className="mt-3 text-sm font-medium text-slate-500 dark:text-slate-400">
          Target: <span className="text-slate-700 dark:text-slate-300">{eta}</span>
        </p>
      )}

      {actions ? <div className="mt-8">{actions}</div> : null}

      <div className="mt-10 space-y-8">
        {focusAreas.map((area) => (
          <section key={area.title}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-500 dark:text-slate-400">
              {area.title}
            </h2>
            <ul className="mt-3 space-y-2 text-slate-700 dark:text-slate-300">
              {area.bullets.map((b) => (
                <li key={b} className="flex gap-2">
                  <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-sky-500" aria-hidden />
                  <span>{b}</span>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50/90 p-6 dark:border-slate-800 dark:bg-slate-900/60">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">What you can do today</h2>
        <ul className="mt-3 list-inside list-disc space-y-1.5 text-sm text-slate-600 dark:text-slate-400">
          {expectations.map((e, i) => (
            <li key={i}>{e}</li>
          ))}
        </ul>
      </div>

      {children}

      <p className="mt-10 text-sm text-slate-500 dark:text-slate-500">
        Read the public{" "}
        <Link href="/roadmap" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          roadmap
        </Link>{" "}
        and{" "}
        <Link href="/docs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          docs
        </Link>{" "}
        for timelines and product context.
      </p>

      <p className="mt-6">
        <Link
          href="/dashboard"
          className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          ← Back to dashboard
        </Link>
      </p>
    </div>
  );
}
