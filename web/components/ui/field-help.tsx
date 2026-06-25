"use client";

import { CircleHelp } from "lucide-react";
import { useId, useRef, useState, type ReactNode } from "react";

/** Inline (i) help for form labels — click to show a short explanation. */
export function FieldHelp({ children }: { children: ReactNode }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  return (
    <span className="relative inline-flex align-middle">
      <button
        ref={buttonRef}
        type="button"
        className="inline-flex rounded-full p-0.5 text-slate-400 hover:text-sky-600 focus-visible:text-sky-600 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-sky-500/40 dark:text-slate-500 dark:hover:text-sky-400"
        aria-label="Show field help"
        aria-expanded={open}
        aria-controls={id}
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          setOpen((v) => !v);
        }}
        onBlur={(e) => {
          if (!e.currentTarget.parentElement?.contains(e.relatedTarget as Node)) {
            setOpen(false);
          }
        }}
      >
        <CircleHelp className="h-3.5 w-3.5 shrink-0" aria-hidden />
      </button>
      {open ? (
        <span
          id={id}
          role="tooltip"
          className="absolute left-0 top-full z-30 mt-1.5 w-72 max-w-[calc(100vw-2rem)] rounded-lg border border-slate-200 bg-white px-3 py-2 text-xs font-normal leading-relaxed text-slate-600 shadow-lg dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 sm:left-1/2 sm:-translate-x-1/2"
        >
          {children}
        </span>
      ) : null}
    </span>
  );
}

export function FieldLabel({ label, help }: { label: string; help?: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-medium text-slate-700 dark:text-slate-300">
      {label}
      {help ? <FieldHelp>{help}</FieldHelp> : null}
    </span>
  );
}

/** Page-level tips box with optional title. */
export function PageHelpBox({
  title = "How this works",
  children,
}: {
  title?: string;
  children: ReactNode;
}) {
  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 text-sm text-slate-700 dark:border-sky-900 dark:bg-sky-950/30 dark:text-slate-300">
      <p className="flex items-center gap-2 font-semibold text-sky-900 dark:text-sky-200">
        <CircleHelp className="h-4 w-4 shrink-0" aria-hidden />
        {title}
      </p>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-slate-600 dark:text-slate-400">{children}</div>
    </div>
  );
}
