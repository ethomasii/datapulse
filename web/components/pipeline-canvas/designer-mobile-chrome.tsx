"use client";

import { useEffect, useState, type ReactNode } from "react";
import { PanelLeft, PanelRight, X } from "lucide-react";
import clsx from "clsx";

type Drawer = "operators" | "config" | null;

type Props = {
  operators: ReactNode;
  config: ReactNode;
  className?: string;
};

/** Mobile-only drawers for Lakeflow operators + config panels. */
export function DesignerMobileChrome({ operators, config, className }: Props) {
  const [drawer, setDrawer] = useState<Drawer>(null);

  useEffect(() => {
    if (!drawer) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setDrawer(null);
    }
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [drawer]);

  return (
    <div className={clsx("lg:hidden", className)}>
      <div className="flex gap-2 border-t border-slate-200 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-900">
        <button
          type="button"
          onClick={() => setDrawer("operators")}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
        >
          <PanelLeft className="h-3.5 w-3.5" aria-hidden />
          Operators
        </button>
        <button
          type="button"
          onClick={() => setDrawer("config")}
          className="inline-flex flex-1 items-center justify-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-medium dark:border-slate-700 dark:bg-slate-950"
        >
          <PanelRight className="h-3.5 w-3.5" aria-hidden />
          Config
        </button>
      </div>

      {drawer ? (
        <div className="fixed inset-0 z-[90] flex flex-col justify-end" role="dialog" aria-modal="true">
          <button
            type="button"
            className="absolute inset-0 bg-black/40"
            aria-label="Close panel"
            onClick={() => setDrawer(null)}
          />
          <div className="relative flex max-h-[min(88dvh,720px)] flex-col overflow-hidden rounded-t-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-200 px-4 py-3 dark:border-slate-800">
              <p className="text-sm font-semibold text-slate-900 dark:text-white">
                {drawer === "operators" ? "Available operators" : "Operator configuration"}
              </p>
              <button
                type="button"
                onClick={() => setDrawer(null)}
                className="rounded-lg p-1 text-slate-500 hover:bg-slate-100 dark:hover:bg-slate-800"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain">
              {drawer === "operators" ? operators : config}
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
