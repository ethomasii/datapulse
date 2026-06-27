import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { tierLabel } from "@/lib/plans/plan-enforcement";

export function PlanGateScreen({
  icon: Icon,
  title,
  description,
  minTier,
}: {
  icon: LucideIcon;
  title: string;
  description: string;
  minTier: PlanTier;
}) {
  return (
    <div className="mx-auto max-w-4xl px-4 py-16 text-center">
      <Icon className="mx-auto mb-4 h-10 w-10 text-slate-300 dark:text-slate-600" aria-hidden />
      <h1 className="mb-2 text-xl font-semibold text-slate-800 dark:text-slate-200">{title}</h1>
      <p className="mb-6 text-slate-500 dark:text-slate-400">{description}</p>
      <Link
        href="/account/billing"
        className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700"
      >
        Upgrade to {tierLabel(minTier)}
      </Link>
    </div>
  );
}
