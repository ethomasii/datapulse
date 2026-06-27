"use client";

import { useTransition } from "react";
import { FlaskConical } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { setDevTier } from "./dev-actions";

const TIERS: { tier: PlanTier; label: string; color: string }[] = [
  {
    tier: "free",
    label: "Free",
    color:
      "border-slate-200 dark:border-slate-600 text-slate-600 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-800",
  },
  {
    tier: "pro",
    label: "Pro",
    color:
      "border-blue-200 dark:border-blue-700 text-blue-700 dark:text-blue-400 hover:bg-blue-50 dark:hover:bg-blue-950/50",
  },
  {
    tier: "team",
    label: "Team",
    color:
      "border-purple-200 dark:border-purple-700 text-purple-700 dark:text-purple-400 hover:bg-purple-50 dark:hover:bg-purple-950/50",
  },
];

export function DevTierSwitcher({ currentTier }: { currentTier: PlanTier }) {
  const [pending, startTransition] = useTransition();

  function switchTo(tier: PlanTier) {
    startTransition(async () => {
      await setDevTier(tier);
    });
  }

  return (
    <div className="rounded-xl border-2 border-dashed border-amber-300 bg-amber-50 p-4 dark:border-amber-700 dark:bg-amber-950/30">
      <div className="mb-3 flex items-center gap-2">
        <FlaskConical className="h-4 w-4 text-amber-600 dark:text-amber-400" />
        <span className="text-sm font-semibold text-amber-800 dark:text-amber-100">Switch plan tier</span>
        <span className="ml-auto rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-600 dark:bg-amber-900/50 dark:text-amber-300">
          Super admin
        </span>
      </div>
      <div className="flex flex-wrap gap-2">
        {TIERS.map(({ tier, label, color }) => (
          <button
            key={tier}
            type="button"
            onClick={() => switchTo(tier)}
            disabled={pending || tier === currentTier}
            className={`rounded-lg border bg-white px-3 py-1.5 text-xs font-medium transition dark:bg-slate-800 ${color} ${
              tier === currentTier
                ? "cursor-default opacity-50 ring-2 ring-amber-400 ring-offset-1 dark:ring-offset-slate-900"
                : "cursor-pointer"
            } disabled:opacity-50`}
          >
            {label}
            {tier === currentTier ? " ✓" : ""}
          </button>
        ))}
      </div>
      <p className="mt-2 text-xs text-amber-600 dark:text-amber-300/90">
        Directly sets the DB subscription tier. Bypasses Stripe entirely.
      </p>
    </div>
  );
}
