import Link from "next/link";
import { Lock } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { PlanGatePill } from "@/components/account/plan-gate-pill";

export function PlanUpgradeHint({
  reason,
  minTier,
  billingHref = "/account/billing",
}: {
  reason: string;
  minTier: PlanTier;
  billingHref?: string;
}) {
  return (
    <div className="flex items-start gap-2 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2.5 text-sm text-amber-950 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-100">
      <Lock className="mt-0.5 h-4 w-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden />
      <p>
        {reason}{" "}
        <Link href={billingHref} className="font-medium text-sky-700 underline hover:text-sky-600 dark:text-sky-300">
          View plans
        </Link>
        <span className="ml-2 inline-flex align-middle">
          <PlanGatePill minTier={minTier} />
        </span>
      </p>
    </div>
  );
}
