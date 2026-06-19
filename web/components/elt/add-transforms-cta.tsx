"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import clsx from "clsx";
import { canvasStarterHref, DEFAULT_LAKE_STARTER_ID } from "@/lib/elt/lake-defaults";

type Props = {
  pipelineId: string;
  pipelineName?: string;
  starterId?: string;
  className?: string;
  compact?: boolean;
};

export function AddTransformsCta({
  pipelineId,
  pipelineName,
  starterId = DEFAULT_LAKE_STARTER_ID,
  className,
  compact = false,
}: Props) {
  const href = canvasStarterHref({ pipelineId, starterId, pipelineName });

  if (compact) {
    return (
      <Link
        href={href}
        className={clsx(
          "inline-flex items-center gap-1 text-xs font-semibold text-violet-700 hover:underline dark:text-violet-300",
          className
        )}
      >
        <Sparkles className="h-3 w-3" aria-hidden />
        Add transforms
      </Link>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-violet-200 bg-violet-50/80 px-4 py-3 dark:border-violet-900/50 dark:bg-violet-950/30",
        className
      )}
    >
      <div className="min-w-0">
        <p className="text-sm font-semibold text-violet-950 dark:text-violet-100">Ingest done — add transforms</p>
        <p className="mt-0.5 text-xs text-violet-800/90 dark:text-violet-200/80">
          Open the canvas with a lake recipe, then link a dbt project for production.
        </p>
      </div>
      <Link
        href={href}
        className="inline-flex shrink-0 items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold text-white hover:bg-violet-500"
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden />
        Add transforms
        <ArrowRight className="h-3.5 w-3.5" aria-hidden />
      </Link>
    </div>
  );
}
