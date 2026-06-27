import { Bot, ChevronUp, Sparkles, Wand2 } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PULSE_AI_NAME } from "@/lib/brand/pulse-ai";

/** CSS mockup of Pulse AI — inline assistant on the visual canvas. */
export function PulseAiPreview({ className = "" }: { className?: string }) {
  return (
    <MarketingFrame title={`eltpulse.dev — Canvas · ${PULSE_AI_NAME}`} className={className}>
      <div className="relative min-h-[300px] bg-[length:20px_20px] bg-slate-50 bg-[radial-gradient(circle,_rgb(148_163_184/0.25)_1px,_transparent_1px)] dark:bg-slate-950 dark:bg-[radial-gradient(circle,_rgb(71_85_105/0.45)_1px,_transparent_1px)]">
        <div className="pointer-events-none absolute inset-x-8 top-10 flex items-center justify-center gap-6 opacity-40">
          <div className="h-16 w-20 rounded-lg border-2 border-emerald-300 bg-white dark:bg-slate-900" />
          <div className="h-1 w-8 rounded bg-sky-300" />
          <div className="h-16 w-20 rounded-lg border-2 border-amber-300 bg-white ring-2 ring-amber-300/50 dark:bg-slate-900" />
          <div className="h-1 w-8 rounded bg-sky-300" />
          <div className="h-16 w-20 rounded-lg border-2 border-sky-300 bg-white dark:bg-slate-900" />
        </div>

        <div className="absolute inset-x-3 bottom-3 overflow-hidden rounded-xl border border-violet-200 bg-white shadow-lg dark:border-violet-900/60 dark:bg-slate-900">
          <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-sky-50 px-3 py-2 dark:border-violet-900/40 dark:from-violet-950/50 dark:to-sky-950/30">
            <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-violet-600 text-white">
              <Bot className="h-4 w-4" aria-hidden />
            </div>
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-1 text-[11px] font-bold text-slate-900 dark:text-white">
                {PULSE_AI_NAME}
                <Sparkles className="h-3 w-3 text-violet-500" aria-hidden />
              </p>
              <p className="truncate text-[9px] text-slate-500">
                Editing step: <span className="font-medium text-amber-700 dark:text-amber-300">dbt · stg_deals</span>
              </p>
            </div>
            <ChevronUp className="h-4 w-4 rotate-180 text-slate-400" aria-hidden />
          </div>

          <div className="space-y-2 p-3">
            <div className="ml-auto max-w-[85%] rounded-lg rounded-tr-sm bg-sky-600 px-2.5 py-2 text-[10px] leading-snug text-white">
              Add a dedupe on deal_id after HubSpot load, then filter to closed-won only
            </div>
            <div className="max-w-[90%] rounded-lg rounded-tl-sm border border-slate-100 bg-slate-50 px-2.5 py-2 dark:border-slate-800 dark:bg-slate-950">
              <p className="flex items-center gap-1 text-[9px] font-semibold text-violet-700 dark:text-violet-300">
                <Wand2 className="h-3 w-3" aria-hidden /> Pipeline updated
              </p>
              <p className="mt-1 text-[10px] leading-snug text-slate-600 dark:text-slate-300">
                Added <strong>dedupe</strong> on <code className="text-[9px]">deal_id</code> and a{" "}
                <strong>filter</strong> for <code className="text-[9px]">dealstage = closedwon</code>. Click Save to
                persist.
              </p>
              <div className="mt-2 flex flex-wrap gap-1">
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  + dedupe node
                </span>
                <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[8px] font-medium text-amber-900 dark:bg-amber-950 dark:text-amber-200">
                  + filter node
                </span>
              </div>
            </div>

            <div className="flex items-end gap-2 pt-1">
              <div className="min-h-[32px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1.5 text-[10px] text-slate-400 dark:border-slate-700 dark:bg-slate-950">
                Add a pivot by region…
              </div>
              <span className="rounded-lg bg-violet-600 px-2.5 py-1.5 text-[10px] font-semibold text-white">Send</span>
            </div>
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}
