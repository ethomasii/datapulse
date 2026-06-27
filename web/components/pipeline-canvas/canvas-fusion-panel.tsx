"use client";

import { useCallback, useEffect, useState } from "react";
import { ChevronDown, ChevronUp, Layers, Loader2 } from "lucide-react";
import clsx from "clsx";
import { readClientFetchJson } from "@/lib/elt/fetch-json-body";
import type { PipelineComponentSpec } from "@/lib/elt/declarative-pipeline-spec";
import type { PipelineFusionAnalysis } from "@/lib/elt/native-components/pipeline-fusion-analysis";

type Props = {
  pipelineId: string;
  eltComponents: PipelineComponentSpec[];
  className?: string;
};

export function CanvasFusionPanel({ pipelineId, eltComponents, className }: Props) {
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [analysis, setAnalysis] = useState<PipelineFusionAnalysis | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!eltComponents.length) {
      setAnalysis(null);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/elt/pipelines/${encodeURIComponent(pipelineId)}/fusion-analysis`,
        {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ elt_components: eltComponents }),
        }
      );
      const data = await readClientFetchJson<{ analysis?: PipelineFusionAnalysis; error?: string }>(
        res
      );
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysis(data.analysis ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
      setAnalysis(null);
    } finally {
      setLoading(false);
    }
  }, [pipelineId, eltComponents]);

  const componentsKey = JSON.stringify(eltComponents);

  useEffect(() => {
    const t = setTimeout(() => void load(), open ? 200 : 600);
    return () => clearTimeout(t);
  }, [load, componentsKey, open]);

  if (!eltComponents.length) return null;

  const fusedSegments = analysis?.segments.filter((s) => s.kind === "fused_sql") ?? [];

  return (
    <div
      className={clsx(
        "shrink-0 border-t border-slate-200 bg-slate-50/90 dark:border-slate-800 dark:bg-slate-900/60",
        className
      )}
    >
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-2 px-3 py-1.5 text-left text-xs text-slate-600 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800/80"
        aria-expanded={open}
      >
        <Layers className="h-3.5 w-3.5 shrink-0 text-violet-600" aria-hidden />
        <span className="font-medium text-slate-800 dark:text-slate-200">Pipeline compaction</span>
        {loading ? (
          <Loader2 className="ml-1 h-3 w-3 animate-spin text-slate-400" aria-hidden />
        ) : analysis ? (
          <span className="truncate text-slate-500 dark:text-slate-400">{analysis.summary}</span>
        ) : error ? (
          <span className="truncate text-amber-700 dark:text-amber-300">{error}</span>
        ) : null}
        <span className="ml-auto shrink-0">
          {open ? (
            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
          ) : (
            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
          )}
        </span>
      </button>

      {open && analysis ? (
        <div className="space-y-2 border-t border-slate-200 px-3 py-2 dark:border-slate-800">
          <div className="flex flex-wrap gap-3 text-[11px] text-slate-600 dark:text-slate-400">
            <span>
              <strong className="text-slate-800 dark:text-slate-200">{analysis.totalSteps}</strong>{" "}
              steps
            </span>
            <span>
              <strong className="text-slate-800 dark:text-slate-200">{analysis.tablesAtRun}</strong>{" "}
              CTAS at run
            </span>
            {analysis.scratchTables > 0 ? (
              <span>
                <strong className="text-slate-800 dark:text-slate-200">
                  {analysis.scratchTables}
                </strong>{" "}
                scratch intermediates
              </span>
            ) : null}
          </div>

          {fusedSegments.length > 0 ? (
            <ul className="space-y-1 text-[11px]">
              {fusedSegments.map((seg) => (
                <li
                  key={seg.stepIds.join("-")}
                  className="rounded border border-violet-200 bg-violet-50/80 px-2 py-1 text-violet-900 dark:border-violet-900 dark:bg-violet-950/30 dark:text-violet-200"
                >
                  Fused {seg.fusedStepCount} steps →{" "}
                  <span className="font-mono">{seg.outputTable ?? "—"}</span>
                  <span className="ml-1 text-violet-700 dark:text-violet-300">
                    ({seg.labels.join(" → ")})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-[11px] text-slate-500">No fused SQL segments on this canvas yet.</p>
          )}

          {analysis.fusionWarnings.length > 0 ? (
            <ul className="text-[10px] text-emerald-700 dark:text-emerald-300">
              {analysis.fusionWarnings.map((w) => (
                <li key={w}>{w}</li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
