import { GitBranch, Layers, Sparkles } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function BuilderPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Pipeline builder">
      <div className="grid min-h-[240px] gap-0 sm:grid-cols-5">
        <div className="border-b border-slate-100 bg-slate-50/50 p-3 dark:border-slate-800 dark:bg-slate-950/50 sm:col-span-2 sm:border-b-0 sm:border-r">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Canvas</p>
          <div className="mt-3 space-y-2">
            <div className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-2 py-1.5 dark:border-sky-900 dark:bg-sky-950/50">
              <Layers className="h-3.5 w-3.5 text-sky-600" />
              <span className="text-[10px] font-medium">Stripe API</span>
            </div>
            <div className="ml-4 h-4 w-px bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-2 rounded-lg border border-violet-200 bg-violet-50 px-2 py-1.5 dark:border-violet-900 dark:bg-violet-950/50">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              <span className="text-[10px] font-medium">dbt staging</span>
            </div>
            <div className="ml-4 h-4 w-px bg-slate-300 dark:bg-slate-600" />
            <div className="flex items-center gap-2 rounded-lg border border-emerald-200 bg-emerald-50 px-2 py-1.5 dark:border-emerald-900 dark:bg-emerald-950/50">
              <GitBranch className="h-3.5 w-3.5 text-emerald-600" />
              <span className="text-[10px] font-medium">Snowflake</span>
            </div>
          </div>
        </div>
        <div className="p-3 sm:col-span-3">
          <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Generated pipeline</p>
          <pre className="mt-2 overflow-hidden rounded-lg bg-slate-950 p-3 text-[9px] leading-relaxed text-emerald-400">
            {`def stripe_customers():
    yield from rest_api(...)

pipeline.run(
  destination="snowflake"
)`}
          </pre>
          <div className="mt-3 flex gap-2">
            <span className="rounded-md bg-sky-600 px-2 py-1 text-[10px] font-semibold text-white">Run now</span>
            <span className="rounded-md border border-slate-200 px-2 py-1 text-[10px] text-slate-600 dark:border-slate-700">
              Export to Git
            </span>
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}
