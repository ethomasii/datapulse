import { cn } from "@/lib/utils";
import type { PlanTier } from "@prisma/client";
import { tierLabel } from "@/lib/plans/plan-enforcement";

/** Shown on locked nav items and feature rows that require a higher plan. */
export function PlanGatePill({
  minTier,
  className,
}: {
  minTier: PlanTier;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "shrink-0 rounded-full border border-amber-200 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-900 dark:border-amber-800 dark:bg-amber-950/50 dark:text-amber-200",
        className
      )}
    >
      {tierLabel(minTier)}
    </span>
  );
}
