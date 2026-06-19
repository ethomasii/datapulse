"use client";

import Link from "next/link";
import { ArrowRight, Database, Sparkles, Table2 } from "lucide-react";
import clsx from "clsx";

type Props = {
  className?: string;
  /** Inline under page titles */
  compact?: boolean;
  /** Show link to recipes */
  showRecipeLink?: boolean;
};

const STEPS = [
  {
    id: "ingest",
    label: "Ingest",
    hint: "Load to your warehouse",
    icon: Database,
    tone: "sky",
  },
  {
    id: "transform",
    label: "Transform",
    hint: "dbt · warehouse SQL",
    icon: Sparkles,
    tone: "violet",
  },
  {
    id: "serve",
    label: "Serve",
    hint: "Marts in Assets",
    icon: Table2,
    tone: "amber",
  },
] as const;

const toneRing: Record<(typeof STEPS)[number]["tone"], string> = {
  sky: "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-100",
  violet:
    "border-violet-200 bg-violet-50 text-violet-900 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100",
  amber:
    "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-100",
};

export function TransformJourneyStrip({ className, compact = false, showRecipeLink = true }: Props) {
  return (
    <div
      className={clsx(
        "rounded-xl border border-slate-200 bg-slate-50/80 dark:border-slate-800 dark:bg-slate-900/60",
        compact ? "px-4 py-3" : "p-4",
        className
      )}
    >
      <div className="flex flex-wrap items-center gap-2 sm:gap-3">
        {STEPS.map((step, i) => (
          <div key={step.id} className="flex items-center gap-2 sm:gap-3">
            <div
              className={clsx(
                "flex items-center gap-2 rounded-lg border px-2.5 py-1.5",
                compact ? "text-xs" : "text-sm",
                toneRing[step.tone]
              )}
            >
              <step.icon className={clsx(compact ? "h-3.5 w-3.5" : "h-4 w-4")} aria-hidden />
              <div>
                <p className="font-semibold leading-none">{step.label}</p>
                {!compact ? <p className="mt-0.5 text-[10px] font-normal opacity-80">{step.hint}</p> : null}
              </div>
            </div>
            {i < STEPS.length - 1 ? (
              <ArrowRight className="h-3.5 w-3.5 shrink-0 text-slate-300 dark:text-slate-600" aria-hidden />
            ) : null}
          </div>
        ))}
      </div>
      {!compact ? (
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
          One lake on any destination — DuckDB, Postgres, Snowflake, BigQuery, and more.{" "}
          {showRecipeLink ? (
            <Link href="/catalog/components#recipes" className="font-medium text-violet-600 underline dark:text-violet-400">
              Browse recipes
            </Link>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
