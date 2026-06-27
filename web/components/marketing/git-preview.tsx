import { Activity, GitBranch, GitCommit } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function GitPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Repositories">
      <div className="flex min-h-[240px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> eltPulse
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Repos
            </li>
          </ul>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 text-[11px] font-semibold text-slate-900 dark:text-white">
            <GitBranch className="h-4 w-4 text-sky-600" aria-hidden />
            acme/analytics · main
          </div>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-3 text-[9px] leading-relaxed text-slate-300">
            {`eltpulse/pipelines/
  hubspot_sync/
    pipeline.py
    config.yaml
  eltpulse_workspace.yaml`}
          </pre>
          <div className="mt-3 flex items-start gap-2 rounded-lg border border-emerald-200 bg-emerald-50/80 px-2.5 py-2 dark:border-emerald-900 dark:bg-emerald-950/30">
            <GitCommit className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden />
            <div>
              <p className="text-[10px] font-medium text-emerald-900 dark:text-emerald-200">Auto-pushed on save</p>
              <p className="text-[9px] text-emerald-800/80 dark:text-emerald-300/80">feat: update hubspot_sync partition config</p>
            </div>
          </div>
        </div>
      </div>
    </MarketingFrame>
  );
}
