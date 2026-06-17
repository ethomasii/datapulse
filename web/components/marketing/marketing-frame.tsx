import type { ReactNode } from "react";

/** Shared browser chrome for CSS product mockups on marketing pages. */
export function MarketingFrame({
  title,
  children,
  className = "",
}: {
  title: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={`relative mx-auto w-full ${className}`} aria-hidden>
      <div className="absolute -inset-3 rounded-3xl bg-gradient-to-br from-sky-400/15 to-violet-400/15 blur-xl" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-900">
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex gap-1.5">
            <span className="h-2 w-2 rounded-full bg-red-400" />
            <span className="h-2 w-2 rounded-full bg-amber-400" />
            <span className="h-2 w-2 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 truncate text-[10px] font-medium text-slate-500 sm:text-xs">{title}</span>
        </div>
        {children}
      </div>
    </div>
  );
}
