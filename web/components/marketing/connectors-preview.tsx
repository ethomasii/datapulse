import { Activity, CheckCircle2, Search } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

const CONNECTORS = [
  { name: "HubSpot", tier: "Verified", slice: "Date slices" },
  { name: "Salesforce", tier: "Verified", slice: "Date slices" },
  { name: "Postgres", tier: "Verified", slice: "Incremental" },
  { name: "Stripe", tier: "Verified", slice: "Date slices" },
];

export function ConnectorsPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Connector catalog">
      <div className="flex min-h-[240px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> eltPulse
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Connectors
            </li>
          </ul>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-2 py-1.5 dark:border-slate-700 dark:bg-slate-950">
            <Search className="h-3.5 w-3.5 text-slate-400" aria-hidden />
            <span className="text-[10px] text-slate-400">Search 111+ sources…</span>
          </div>
          <ul className="mt-3 space-y-2">
            {CONNECTORS.map((c) => (
              <li
                key={c.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-2 dark:border-slate-800"
              >
                <div>
                  <p className="text-[11px] font-semibold text-slate-900 dark:text-white">{c.name}</p>
                  <p className="text-[9px] text-slate-500">{c.slice}</p>
                </div>
                <span className="inline-flex items-center gap-0.5 rounded-full bg-emerald-50 px-1.5 py-0.5 text-[8px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
                  <CheckCircle2 className="h-2.5 w-2.5" aria-hidden />
                  {c.tier}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingFrame>
  );
}
