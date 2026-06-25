"use client";

import { useState } from "react";
import Link from "next/link";
import clsx from "clsx";
import { LAKE_PIPELINE_STARTERS } from "@/lib/elt/lake-pipeline-starters";
import {
  LakeStarterApplyDialog,
  type LakeStarterApplyResult,
} from "@/components/elt/lake-starter-apply-dialog";
import { TransformJourneyStrip } from "@/components/elt/transform-journey-strip";
import type { PipelineCanvasGraph } from "@/lib/elt/canvas-source-config";

/** Short labels for canvas empty-state chips */
export const LAKE_STARTER_CHIP_LABELS: Record<string, string> = {
  single_lake_medallion: "Medallion",
  single_source_to_mart: "Quick mart",
  single_source_enrich: "Enrich + DQ",
  multi_source_union_rollup: "Union rollup",
  entity_360_profile: "Entity 360",
};

type Props = {
  onApply: (result: LakeStarterApplyResult) => void;
  defaultSourceTable?: string;
  existingCanvas?: PipelineCanvasGraph | null;
  className?: string;
  /** Centered overlay on canvas */
  variant?: "overlay" | "inline";
};

export function LakeStarterChips({
  onApply,
  defaultSourceTable = "staging.events",
  existingCanvas,
  className,
  variant = "inline",
}: Props) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const active = LAKE_PIPELINE_STARTERS.find((s) => s.id === activeId) ?? null;

  const chips = (
    <div className="flex flex-wrap justify-center gap-2">
      {LAKE_PIPELINE_STARTERS.map((starter) => (
        <button
          key={starter.id}
          type="button"
          onClick={() => setActiveId(starter.id)}
          className="rounded-full border border-violet-200 bg-violet-50 px-3 py-1.5 text-xs font-medium text-violet-900 transition hover:border-violet-400 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/50 dark:text-violet-100 dark:hover:bg-violet-900/40"
        >
          {LAKE_STARTER_CHIP_LABELS[starter.id] ?? starter.title}
        </button>
      ))}
    </div>
  );

  if (variant === "overlay") {
    return (
      <>
        <div
          className={clsx(
            "rounded-xl border border-violet-200/80 bg-white/95 px-5 py-4 text-center shadow-lg backdrop-blur-sm dark:border-violet-800/60 dark:bg-slate-900/95",
            className
          )}
        >
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Start with a transform recipe</p>
          <p className="mt-1 text-xs text-slate-500">Or drag components from the sidebar to build your own graph.</p>
          <div className="mt-2">
            <TransformJourneyStrip compact showRecipeLink={false} />
          </div>
          <div className="mt-3">{chips}</div>
          <p className="mt-3 text-[11px] text-slate-400">
            Or drag components from the sidebar ·{" "}
            <Link href="/catalog/components#recipes" className="text-sky-600 underline dark:text-sky-400">
              all recipes
            </Link>
          </p>
        </div>
        {active ? (
          <LakeStarterApplyDialog
            starter={active}
            onClose={() => setActiveId(null)}
            onApply={onApply}
            defaultSourceTable={defaultSourceTable}
            existingCanvas={existingCanvas}
          />
        ) : null}
      </>
    );
  }

  return (
    <div className={className}>
      {chips}
      {active ? (
        <LakeStarterApplyDialog
          starter={active}
          onClose={() => setActiveId(null)}
          onApply={onApply}
          defaultSourceTable={defaultSourceTable}
          existingCanvas={existingCanvas}
        />
      ) : null}
    </div>
  );
}
