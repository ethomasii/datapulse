import { Bot, ChevronUp, Send, Sparkles, Wand2 } from "lucide-react";
import { CanvasPreview } from "@/components/marketing/canvas-preview";
import { MarketingFrame } from "@/components/marketing/marketing-frame";
import { PULSE_AI_NAME } from "@/lib/brand/pulse-ai";

/** Pulse AI chat expanded over the full canvas designer mockup. */
export function PulseAiPreview({ className = "" }: { className?: string }) {
  return (
    <div className={`relative ${className}`}>
      <CanvasPreview className="opacity-90" />
      <div className="pointer-events-none absolute inset-x-4 bottom-[100px] z-20 overflow-hidden rounded-xl border border-violet-200 bg-white/95 shadow-xl backdrop-blur-sm dark:border-violet-900/60 dark:bg-slate-900/95">
        <div className="flex items-center gap-2 border-b border-violet-100 bg-gradient-to-r from-violet-50 to-sky-50 px-3 py-2 dark:border-violet-900/40 dark:from-violet-950/50 dark:to-sky-950/30">
          <div className="flex h-6 w-6 items-center justify-center rounded-lg bg-violet-600 text-white">
            <Bot className="h-3.5 w-3.5" aria-hidden />
          </div>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1 text-[10px] font-bold text-slate-900 dark:text-white">
              {PULSE_AI_NAME}
              <Sparkles className="h-3 w-3 text-violet-500" aria-hidden />
            </p>
            <p className="truncate text-[8px] text-slate-500">
              Editing: <span className="font-medium text-amber-700 dark:text-amber-300">filter · closedwon</span>
            </p>
          </div>
          <ChevronUp className="h-3.5 w-3.5 rotate-180 text-slate-400" aria-hidden />
        </div>
        <div className="space-y-2 p-2.5">
          <div className="ml-auto max-w-[88%] rounded-lg rounded-tr-sm bg-sky-600 px-2 py-1.5 text-[9px] leading-snug text-white">
            Add dedupe on deal_id before the filter step
          </div>
          <div className="max-w-[92%] rounded-lg rounded-tl-sm border border-slate-100 bg-slate-50 px-2 py-1.5 dark:border-slate-800 dark:bg-slate-950">
            <p className="flex items-center gap-1 text-[8px] font-semibold text-violet-700 dark:text-violet-300">
              <Wand2 className="h-3 w-3" aria-hidden /> Canvas updated
            </p>
            <p className="mt-0.5 text-[9px] text-slate-600 dark:text-slate-300">
              Wired <strong>dedupe</strong> between HubSpot and filter. Save to persist.
            </p>
          </div>
          <div className="flex items-end gap-1.5">
            <div className="min-h-[28px] flex-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-[9px] text-slate-400 dark:border-slate-700 dark:bg-slate-950">
              Add a pivot by region…
            </div>
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-teal-600 text-white">
              <Send className="h-3 w-3" aria-hidden />
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
