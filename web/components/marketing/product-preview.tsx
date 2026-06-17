import { Activity, CheckCircle2, Layers, Play, Zap } from "lucide-react";

/** CSS-only product mockup for the marketing homepage — no screenshots required. */
export function ProductPreview() {
  return (
    <div
      className="relative mx-auto w-full max-w-lg"
      aria-hidden
    >
      <div className="absolute -inset-4 rounded-3xl bg-gradient-to-br from-sky-400/20 to-violet-400/20 blur-2xl dark:from-sky-600/20 dark:to-violet-600/20" />
      <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-2xl shadow-slate-200/50 dark:border-slate-700 dark:bg-slate-900 dark:shadow-black/40">
        {/* Title bar */}
        <div className="flex items-center gap-2 border-b border-slate-100 bg-slate-50 px-4 py-2.5 dark:border-slate-800 dark:bg-slate-950">
          <div className="flex gap-1.5">
            <span className="h-2.5 w-2.5 rounded-full bg-red-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-amber-400" />
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
          </div>
          <span className="ml-2 text-xs font-medium text-slate-500">eltpulse.dev — Quick start</span>
        </div>

        <div className="flex min-h-[280px]">
          {/* Sidebar */}
          <div className="hidden w-36 shrink-0 border-r border-slate-100 bg-slate-50/80 p-3 dark:border-slate-800 dark:bg-slate-950/80 sm:block">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-sky-600">
              <Activity className="h-3.5 w-3.5" /> eltPulse
            </div>
            <ul className="mt-4 space-y-1.5 text-[10px] font-medium text-slate-600 dark:text-slate-400">
              <li className="rounded-md bg-sky-100 px-2 py-1 text-sky-800 dark:bg-sky-950 dark:text-sky-200">
                Quick start
              </li>
              <li className="px-2 py-1">Pipelines</li>
              <li className="px-2 py-1">Runs</li>
              <li className="px-2 py-1">Connections</li>
            </ul>
          </div>

          {/* Main */}
          <div className="flex-1 p-4">
            <div className="rounded-xl bg-gradient-to-r from-sky-600 to-sky-500 px-4 py-3 text-white">
              <div className="flex items-center gap-2 text-[10px] font-semibold uppercase tracking-wider text-sky-100">
                <Zap className="h-3 w-3" /> Getting started
              </div>
              <p className="mt-1 text-sm font-bold">Set up your first pipeline</p>
              <div className="mt-2 h-1 overflow-hidden rounded-full bg-white/25">
                <div className="h-full w-2/3 rounded-full bg-white" />
              </div>
            </div>

            <div className="mt-3 grid grid-cols-3 gap-2">
              {[
                { icon: Layers, label: "Connect", done: true },
                { icon: Play, label: "Build", done: true },
                { icon: CheckCircle2, label: "Run", done: false },
              ].map(({ icon: Icon, label, done }) => (
                <div
                  key={label}
                  className={`rounded-lg border p-2 text-center ${
                    done
                      ? "border-emerald-200 bg-emerald-50 dark:border-emerald-900 dark:bg-emerald-950/40"
                      : "border-sky-200 bg-sky-50 dark:border-sky-900 dark:bg-sky-950/30"
                  }`}
                >
                  <Icon
                    className={`mx-auto h-4 w-4 ${done ? "text-emerald-600" : "text-sky-600"}`}
                  />
                  <p className="mt-1 text-[9px] font-semibold text-slate-700 dark:text-slate-300">{label}</p>
                </div>
              ))}
            </div>

            <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50/80 px-3 py-2 dark:border-amber-900/50 dark:bg-amber-950/30">
              <p className="text-[10px] font-semibold text-amber-900 dark:text-amber-200">stripe → snowflake</p>
              <p className="mt-0.5 text-[9px] text-amber-800/80 dark:text-amber-300/80">
                Run succeeded · 100 rows · 2m ago
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
