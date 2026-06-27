import { Activity, Mail, Users } from "lucide-react";
import { MarketingFrame } from "@/components/marketing/marketing-frame";

const MEMBERS = [
  { name: "Jordan Lee", role: "Owner", you: false },
  { name: "Alex Kim", role: "Member", you: true },
  { name: "Sam Okonkwo", role: "Viewer", you: false },
];

export function TeamPreview() {
  return (
    <MarketingFrame title="eltpulse.dev — Team">
      <div className="flex min-h-[220px]">
        <div className="hidden w-28 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
          <div className="flex items-center gap-1 text-[10px] font-semibold text-sky-600">
            <Activity className="h-3 w-3" /> eltPulse
          </div>
          <ul className="mt-3 space-y-1 text-[9px] text-slate-500">
            <li className="rounded bg-sky-100 px-1 py-0.5 font-medium text-sky-800 dark:bg-sky-950 dark:text-sky-200">
              Team
            </li>
          </ul>
        </div>
        <div className="flex-1 p-4">
          <div className="flex items-center justify-between">
            <p className="flex items-center gap-1.5 text-[11px] font-bold text-slate-900 dark:text-white">
              <Users className="h-3.5 w-3.5 text-violet-600" aria-hidden />
              Acme Data workspace
            </p>
            <span className="inline-flex items-center gap-1 rounded-full bg-violet-100 px-2 py-0.5 text-[8px] font-semibold text-violet-800 dark:bg-violet-950 dark:text-violet-200">
              <Mail className="h-2.5 w-2.5" aria-hidden />
              Invite
            </span>
          </div>
          <ul className="mt-3 space-y-2">
            {MEMBERS.map((m) => (
              <li
                key={m.name}
                className="flex items-center justify-between rounded-lg border border-slate-100 px-2.5 py-2 dark:border-slate-800"
              >
                <div>
                  <p className="text-[10px] font-medium text-slate-900 dark:text-white">
                    {m.name}
                    {m.you ? <span className="ml-1 text-slate-400">(you)</span> : null}
                  </p>
                  <p className="text-[9px] text-slate-500">{m.role}</p>
                </div>
                <span className="h-6 w-6 rounded-full bg-gradient-to-br from-sky-400 to-violet-500" />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </MarketingFrame>
  );
}
