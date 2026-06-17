import { Activity, CheckCircle2, LineChart } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function RunsPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Runs & observability">
      <div className="flex min-h-[240px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> eltPulse
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="px-1">Pipelines</li>
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Runs
            </li>
          </ul>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
            <p className="text-sm font-bold text-slate-900 dark:text-white">stripe → snowflake</p>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
              <CheckCircle2 className="h-3 w-3" /> succeeded
            </span>
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-center">
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
              <p className="text-[9px] text-slate-500">Rows</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">48.2k</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
              <p className="text-[9px] text-slate-500">Duration</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">2m 14s</p>
            </div>
            <div className="rounded-lg bg-slate-50 p-2 dark:bg-slate-950">
              <p className="text-[9px] text-slate-500">Phase</p>
              <p className="text-sm font-bold text-slate-900 dark:text-white">load</p>
            </div>
          </div>
          <div className="mt-3 rounded-lg border border-slate-100 p-2 dark:border-slate-800">
            <div className="flex items-center gap-1 text-[9px] font-medium text-slate-500">
              <LineChart className="h-3 w-3" /> Telemetry
            </div>
            <div className="mt-2 flex h-12 items-end gap-0.5">
              {[20, 35, 28, 55, 48, 72, 90, 100].map((h, i) => (
                <div
                  key={i}
                  className="flex-1 rounded-t bg-sky-500/80"
                  style={{ height: `${h}%` }}
                />
              ))}
            </div>
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}
