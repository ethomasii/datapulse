"use client";

import type { BillingInterval } from "@/lib/billing/plan-pricing";

export function BillingIntervalToggle({
  value,
  onChange,
  className = "",
}: {
  value: BillingInterval;
  onChange: (interval: BillingInterval) => void;
  className?: string;
}) {
  return (
    <div className={`flex items-center gap-3 ${className}`}>
      <button
        type="button"
        onClick={() => onChange("monthly")}
        className={`rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          value === "monthly"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
        }`}
      >
        Monthly
      </button>
      <button
        type="button"
        onClick={() => onChange("annual")}
        className={`flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-medium transition ${
          value === "annual"
            ? "bg-slate-900 text-white dark:bg-slate-100 dark:text-slate-900"
            : "text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-100"
        }`}
      >
        Annual
        <span className="rounded-full bg-green-100 px-2 py-0.5 text-xs font-semibold text-green-700 dark:bg-green-900/40 dark:text-green-300">
          Save 2 months
        </span>
      </button>
    </div>
  );
}
