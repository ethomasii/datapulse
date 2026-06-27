import { Activity, Code2, Key } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

export function ApiPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Developers">
      <div className="flex min-h-[220px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> Account
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Developers
            </li>
          </ul>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 dark:text-white">
              <Key className="h-3.5 w-3.5 text-amber-600" aria-hidden />
              API keys
            </p>
            <span className="rounded bg-slate-900 px-2 py-0.5 text-[8px] font-medium text-white dark:bg-slate-100 dark:text-slate-900">
              + Create
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {["CI deploy", "Run trigger"].map((name) => (
              <li
                key={name}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-2 dark:border-slate-800"
              >
                <span className="text-[10px] font-medium text-slate-800 dark:text-slate-200">{name}</span>
                <code className="font-mono text-[9px] text-slate-500">ep_live_••••7f2a</code>
              </li>
            ))}
          </ul>
          <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950 p-2 text-[8px] text-slate-400">
            <Code2 className="mb-1 inline h-3 w-3" aria-hidden />
            {` curl -H "Authorization: Bearer $KEY" \\
   https://app.eltpulse.dev/api/elt/runs`}
          </pre>
        </div>
      </div>
    </MarketingFrame>
  );
}
