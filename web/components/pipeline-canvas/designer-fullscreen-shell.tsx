"use client";

import Link from "next/link";
import clsx from "clsx";
import { Loader2, Plus } from "lucide-react";
import type { ReactNode } from "react";

type PipelineRow = { id: string; name: string };

type CanvasView = "designer" | "ingest" | "dag";

type Props = {
  pipelines: PipelineRow[];
  selectedId: string;
  selectedName?: string | null;
  canvasView: CanvasView;
  onCanvasViewChange: (view: CanvasView) => void;
  onPipelineChange: (id: string) => void;
  onNewPipeline: () => void;
  loading?: boolean;
  transformOnly?: boolean;
  children: ReactNode;
};

/** Fixed fullscreen workspace for the Lakeflow designer — below app header, beside nav. */
export function DesignerFullscreenShell({
  pipelines,
  selectedId,
  selectedName,
  canvasView,
  onCanvasViewChange,
  onPipelineChange,
  onNewPipeline,
  loading = false,
  transformOnly = false,
  children,
}: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col bg-white dark:bg-slate-950 md:left-56"
      aria-label="Pipeline designer"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Visual canvas
          </p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {selectedName ?? "Pipeline designer"}
            {transformOnly ? (
              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                Transform only
              </span>
            ) : null}
          </p>
        </div>

        <label className="flex min-w-[10rem] flex-1 items-center gap-2 sm:max-w-xs">
          <span className="sr-only">Pipeline</span>
          <select
            value={selectedId}
            onChange={(e) => onPipelineChange(e.target.value)}
            className="w-full rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </label>

        <button
          type="button"
          onClick={onNewPipeline}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-300 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-950 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <Plus className="h-3.5 w-3.5" aria-hidden />
          New
        </button>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
          {(
            [
              ["designer", "Designer", "bg-sky-600 text-white"],
              ["ingest", "Ingest", "bg-emerald-600 text-white"],
              ["dag", "Transform DAG", "bg-sky-600 text-white"],
            ] as const
          ).map(([id, label, activeClass]) => (
            <button
              key={id}
              type="button"
              onClick={() => onCanvasViewChange(id)}
              className={clsx(
                "rounded-md px-2.5 py-1 text-xs font-medium",
                canvasView === id
                  ? activeClass
                  : "text-slate-600 hover:bg-slate-50 dark:text-slate-300 dark:hover:bg-slate-800"
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {selectedId ? (
          <Link
            href={`/builder?pipeline=${encodeURIComponent(selectedId)}`}
            className="text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Form builder →
          </Link>
        ) : null}
      </header>

      <div className="relative min-h-0 flex-1">
        {loading ? (
          <div className="flex h-full items-center justify-center bg-slate-50 dark:bg-slate-900/50">
            <Loader2 className="h-6 w-6 animate-spin text-slate-400" aria-hidden />
          </div>
        ) : (
          children
        )}
      </div>
    </div>
  );
}
