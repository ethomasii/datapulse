import { Activity, CalendarClock, Split, Webhook } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function OrchestrationPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Orchestration">
      <div className="flex min-h-[240px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> eltPulse
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="px-1">Schedule</li>
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Monitors
            </li>
          </ul>
        </div>
        <div className="flex-1 space-y-2 p-4">
          <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-800 dark:text-slate-200">
              <CalendarClock className="h-3.5 w-3.5 text-violet-600" aria-hidden />
              hubspot_sync · cron
            </div>
            <p className="mt-1 font-mono text-[9px] text-slate-500">0 6 * * * · America/New_York</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-800 dark:text-slate-200">
              <Split className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              Run slices · backfill
            </div>
            <p className="mt-1 text-[9px] text-slate-500">partition_key: 2024-01-15 · 2024-01-16 · 2024-01-17</p>
          </div>
          <div className="rounded-lg border border-slate-100 p-2.5 dark:border-slate-800">
            <div className="flex items-center gap-1.5 text-[10px] font-semibold text-slate-800 dark:text-slate-200">
              <Webhook className="h-3.5 w-3.5 text-sky-600" aria-hidden />
              Webhook on success
            </div>
            <p className="mt-1 truncate font-mono text-[9px] text-slate-500">POST hooks.acme.dev/eltpulse</p>
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}
