"use client";

import { useState } from "react";
import { Sparkles } from "lucide-react";
import clsx from "clsx";
import { LAKE_PIPELINE_STARTERS, type LakePipelineStarter } from "@/lib/elt/lake-pipeline-starters";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";
import {
  LakeStarterApplyDialog,
  type LakeStarterApplyResult,
} from "@/components/elt/lake-starter-apply-dialog";

type Props = {
  onApplyToCanvas?: (result: LakeStarterApplyResult) => void;
  canvasHref?: (starterId: string) => string;
  defaultSourceTable?: string;
  existingCanvas?: PipelineCanvasGraph | null;
  compact?: boolean;
  className?: string;
  requirePipeline?: boolean;
};

export function LakeStarterGallery({
  onApplyToCanvas,
  canvasHref,
  defaultSourceTable = "staging.events",
  existingCanvas,
  compact = false,
  className,
}: Props) {
  const [active, setActive] = useState<LakePipelineStarter | null>(null);

  function openStarter(starter: LakePipelineStarter) {
    setActive(starter);
  }

  return (
    <section
      id="recipes"
      className={clsx(
        "scroll-mt-6 space-y-4 rounded-xl border border-violet-200/80 bg-gradient-to-b from-violet-50/40 to-white p-5 dark:border-violet-900/40 dark:from-violet-950/20 dark:to-slate-950",
        className
      )}
    >
      <div>
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-4 w-4 text-violet-600 dark:text-violet-400" aria-hidden />
          <h2 className={clsx("font-semibold text-slate-900 dark:text-white", compact ? "text-sm" : "text-lg")}>
            Pipeline recipes
          </h2>
          <span className="rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
            Recommended
          </span>
        </div>
        <p className="mt-1 text-xs text-slate-500">
          Curated transform chains after ingest — any warehouse. Click a card to configure tables, then open canvas.
        </p>
      </div>

      <div className={clsx("grid gap-3", compact ? "grid-cols-1" : "sm:grid-cols-2 lg:grid-cols-3")}>
        {LAKE_PIPELINE_STARTERS.map((starter, index) => (
          <button
            key={starter.id}
            type="button"
            onClick={() => openStarter(starter)}
            className="group relative rounded-xl border border-slate-200 bg-white p-4 text-left transition hover:border-violet-300 hover:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:hover:border-violet-600"
          >
            <span className="absolute right-3 top-3 flex h-6 w-6 items-center justify-center rounded-full bg-violet-100 text-[10px] font-bold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              {index + 1}
            </span>
            <div className="flex items-start justify-between gap-2">
              <p className="text-sm font-semibold text-slate-900 group-hover:text-violet-700 dark:text-white dark:group-hover:text-violet-300">
                {starter.title}
              </p>
              <span className="shrink-0 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-medium text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                {starter.sourceCount === "many" ? "multi" : `${starter.sourceCount} src`}
              </span>
            </div>
            <p className="mt-2 line-clamp-2 text-xs leading-relaxed text-slate-600 dark:text-slate-400">
              {starter.description}
            </p>
            <p className="mt-3 text-[10px] font-medium text-violet-600 dark:text-violet-400">
              {starter.components({ source_table: "staging.example" }).length} steps · warehouse SQL
            </p>
          </button>
        ))}
      </div>

      {active ? (
        <LakeStarterApplyDialog
          starter={active}
          onClose={() => setActive(null)}
          onApply={onApplyToCanvas}
          onNavigate={
            !onApplyToCanvas
              ? (id, params) => {
                  window.location.href = `/builder/canvas?starter=${encodeURIComponent(id)}&source_table=${encodeURIComponent(params.source_table)}`;
                }
              : undefined
          }
          defaultSourceTable={defaultSourceTable}
          existingCanvas={existingCanvas}
          applyLabel={onApplyToCanvas ? "Add to canvas" : "Open canvas"}
        />
      ) : null}
    </section>
  );
}
