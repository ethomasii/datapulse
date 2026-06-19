"use client";

import Link from "next/link";
import { Sparkles } from "lucide-react";
import clsx from "clsx";
import { LAKE_PIPELINE_TAGLINE, WAREHOUSE_COMPUTE_HINT } from "@/lib/elt/lake-defaults";

type Props = {
  className?: string;
  compact?: boolean;
};

export function LakePipelineIntro({ className, compact = false }: Props) {
  return (
    <section
      className={clsx(
        "rounded-xl border border-violet-200 bg-gradient-to-br from-violet-50/80 to-white dark:border-violet-900/50 dark:from-violet-950/30 dark:to-slate-900",
        compact ? "p-4" : "p-5",
        className
      )}
    >
      <div className="flex items-start gap-3">
        <Sparkles className="h-5 w-5 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
        <div>
          <h2 className={clsx("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-base")}>
            Lake pipelines — any warehouse, one graph
          </h2>
          <p className="mt-1 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{LAKE_PIPELINE_TAGLINE}</p>
          {!compact ? (
            <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">{WAREHOUSE_COMPUTE_HINT}</p>
          ) : null}
          <p className="mt-3 flex flex-wrap gap-x-3 gap-y-1 text-xs font-medium">
            <Link href="/catalog/components#recipes" className="text-violet-700 underline dark:text-violet-300">
              Pipeline recipes
            </Link>
            <Link href="/builder/canvas" className="text-sky-600 underline dark:text-sky-400">
              Canvas designer
            </Link>
            <Link href="/catalog/dbt" className="text-slate-600 underline dark:text-slate-400">
              Optional dbt projects
            </Link>
          </p>
        </div>
      </div>
    </section>
  );
}
