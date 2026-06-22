import Link from "next/link";
import { ArrowRight, CheckCircle } from "lucide-react";
import type { Competitor } from "@/lib/marketing/competitors";

export function CompareCompetitorCard({ competitor: c }: { competitor: Competitor }) {
  return (
    <Link
      href={`/compare/${c.slug}`}
      className="group rounded-2xl border border-slate-200 bg-white p-6 transition hover:border-blue-300 hover:shadow-md hover:shadow-blue-50 dark:border-slate-800 dark:bg-slate-950 dark:hover:border-blue-700 dark:hover:shadow-blue-900/20"
    >
      <div className="flex items-start justify-between">
        <h3 className="font-semibold text-slate-900 group-hover:text-blue-600 dark:text-white dark:group-hover:text-blue-400">
          eltPulse vs. {c.name}
        </h3>
        <ArrowRight className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 transition group-hover:translate-x-1 group-hover:text-blue-500" />
      </div>
      <p className="mt-2 text-sm leading-relaxed text-slate-500 dark:text-slate-400">{c.description}</p>
      <div className="mt-4 space-y-1.5">
        {c.theyreGoodAt.slice(0, 2).map((strength) => (
          <div key={strength} className="flex items-start gap-2 text-xs text-slate-600 dark:text-slate-400">
            <CheckCircle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-green-500" />
            {strength}
          </div>
        ))}
      </div>
    </Link>
  );
}
