"use client";

import { AlertTriangle, ChevronDown, ChevronUp, Info } from "lucide-react";
import clsx from "clsx";
import { useState } from "react";
import type { OperatorDiagnostic } from "@/lib/elt/operator-diagnostics";
import { operatorDiagnosticSourceLabel } from "@/lib/elt/operator-diagnostics";

type Props = {
  diagnostics: OperatorDiagnostic[];
  /** Compact bar above preview strip; default is full sidebar card. */
  variant?: "sidebar" | "strip";
  className?: string;
  /** Sidebar panel starts collapsed to reduce layout shift while editing. */
  defaultExpanded?: boolean;
};

/** Aggregated step issues — column load, input/output preview, warehouse connection hints. */
export function OperatorDiagnosticsPanel({
  diagnostics,
  variant = "sidebar",
  className,
  defaultExpanded = false,
}: Props) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  if (!diagnostics.length) return null;

  const errors = diagnostics.filter((d) => d.severity === "error");
  const warnings = diagnostics.filter((d) => d.severity === "warning");
  const headline =
    errors.length > 0
      ? `${errors.length} issue${errors.length === 1 ? "" : "s"} blocking this step`
      : `${warnings.length} warning${warnings.length === 1 ? "" : "s"}`;

  if (variant === "strip") {
    return (
      <div
        className={clsx(
          "flex shrink-0 items-start gap-2 border-b border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/40",
          className
        )}
        role="alert"
      >
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-medium text-amber-950 dark:text-amber-100">{headline}</p>
          <p className="mt-0.5 truncate text-[10px] text-amber-900/90 dark:text-amber-200/90">
            {diagnostics[0]?.message}
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className={clsx(
        "rounded-lg border border-amber-200 bg-amber-50/90 dark:border-amber-900/60 dark:bg-amber-950/30",
        className
      )}
      role="alert"
    >
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
        aria-expanded={expanded}
      >
        <div className="flex min-w-0 items-center gap-2">
          <AlertTriangle className="h-4 w-4 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-amber-950 dark:text-amber-100">Step diagnostics</p>
            <p className="text-[10px] text-amber-900/80 dark:text-amber-200/80">{headline}</p>
          </div>
        </div>
        {expanded ? (
          <ChevronUp className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        ) : (
          <ChevronDown className="h-3.5 w-3.5 shrink-0 text-amber-700 dark:text-amber-300" aria-hidden />
        )}
      </button>

      {expanded ? (
        <ul className="max-h-40 space-y-2 overflow-y-auto overscroll-contain border-t border-amber-200/80 px-3 py-2 dark:border-amber-900/40">
          {diagnostics.map((item) => (
            <li key={item.id} className="text-[11px]">
              <p className="font-medium text-amber-950 dark:text-amber-100">
                {operatorDiagnosticSourceLabel(item.source)}
              </p>
              <p className="mt-0.5 text-amber-900 dark:text-amber-200">{item.message}</p>
              {item.hint ? (
                <p className="mt-1 flex gap-1.5 text-[10px] leading-snug text-amber-800/90 dark:text-amber-300/90">
                  <Info className="mt-0.5 h-3 w-3 shrink-0 opacity-70" aria-hidden />
                  <span>{item.hint}</span>
                </p>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
