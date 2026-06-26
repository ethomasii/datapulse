"use client";

import Link from "next/link";
import clsx from "clsx";
import { Loader2 } from "lucide-react";
import type { ReactNode } from "react";

type CanvasView = "designer" | "ingest" | "dag";

type Props = {
  selectedName?: string | null;
  canvasView: CanvasView;
  onCanvasViewChange: (view: CanvasView) => void;
  formBuilderHref: string;
  loading?: boolean;
  transformOnly?: boolean;
  readOnly?: boolean;
  readOnlyRole?: string | null;
  children: ReactNode;
};

/** Fixed fullscreen workspace for pipeline canvas — below app header, beside nav. */
export function DesignerFullscreenShell({
  selectedName,
  canvasView,
  onCanvasViewChange,
  formBuilderHref,
  loading = false,
  transformOnly = false,
  readOnly = false,
  readOnlyRole,
  children,
}: Props) {
  return (
    <div
      className="fixed inset-x-0 bottom-0 top-14 z-40 flex flex-col bg-white dark:bg-slate-950 md:left-60"
      aria-label="Pipeline canvas"
    >
      <header className="flex shrink-0 flex-wrap items-center gap-x-3 gap-y-2 border-b border-slate-200 bg-slate-50/95 px-3 py-2 dark:border-slate-800 dark:bg-slate-900/95">
        <div className="min-w-0 flex-1 sm:flex-none">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-sky-600 dark:text-sky-400">
            Canvas
          </p>
          <p className="truncate text-sm font-semibold text-slate-900 dark:text-white">
            {selectedName ?? "Pipeline"}
            {transformOnly ? (
              <span className="ml-2 rounded-full bg-violet-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-violet-800 dark:bg-violet-950 dark:text-violet-200">
                Transform only
              </span>
            ) : null}
          </p>
        </div>

        <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5 dark:border-slate-700 dark:bg-slate-950">
          {(
            [
              ["designer", "Designer", "bg-sky-600 text-white"],
              ["ingest", "Ingest", "bg-sky-600 text-white"],
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

        <span className="hidden text-xs text-slate-500 lg:inline">
          {canvasView === "ingest"
            ? "Source → landing tables"
            : canvasView === "dag"
              ? "Transform dependency graph"
              : "Drag operators onto the graph"}
        </span>

        <Link
          href={formBuilderHref}
          className="ml-auto text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          Form builder →
        </Link>
      </header>

      {readOnly ? (
        <p className="shrink-0 border-b border-slate-200 bg-slate-100 px-3 py-1.5 text-xs text-slate-700 dark:border-slate-800 dark:bg-slate-900 dark:text-slate-300">
          Read-only workspace role{readOnlyRole ? ` (${readOnlyRole})` : ""} — you can browse but cannot save changes.
        </p>
      ) : null}

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
