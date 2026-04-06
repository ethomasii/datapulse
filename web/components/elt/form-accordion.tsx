"use client";

import { ChevronRight } from "lucide-react";

type Props = {
  id: string;
  title: string;
  subtitle?: string;
  defaultOpen?: boolean;
  badge?: string;
  children: React.ReactNode;
};

/** Native `<details>` accordion with consistent styling (no extra deps). */
export function FormAccordion({ id, title, subtitle, defaultOpen = false, badge, children }: Props) {
  return (
    <details
      id={id}
      open={defaultOpen}
      className="group rounded-xl border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900/80"
    >
      <summary className="flex cursor-pointer list-none items-center gap-2 px-4 py-3 font-medium text-slate-900 marker:hidden dark:text-white [&::-webkit-details-marker]:hidden">
        <ChevronRight
          className="h-4 w-4 shrink-0 text-slate-500 transition-transform group-open:rotate-90 dark:text-slate-400"
          aria-hidden
        />
        <span>{title}</span>
        {badge ? (
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-normal text-slate-600 dark:bg-slate-800 dark:text-slate-300">
            {badge}
          </span>
        ) : null}
      </summary>
      <div className="border-t border-slate-100 px-4 pb-4 pt-1 dark:border-slate-800">
        {subtitle ? <p className="mb-3 text-xs text-slate-500 dark:text-slate-400">{subtitle}</p> : null}
        {children}
      </div>
    </details>
  );
}
