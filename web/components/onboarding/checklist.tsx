import Link from "next/link";
import {
  Layers,
  Plug,
  Waypoints,
  Play,
  Webhook,
  ArrowRight,
  CheckCircle2,
  Zap,
} from "lucide-react";
import { ONBOARDING_STEPS } from "@/lib/onboarding/config";
import { DismissOnboardingButton } from "./dismiss-button";

const STEP_ICONS: Record<string, React.ElementType> = {
  pipeline: Layers,
  connection: Plug,
  gateway: Waypoints,
  run: Play,
  webhook: Webhook,
};

export function OnboardingChecklist({ completedIds }: { completedIds: string[] }) {
  const total = ONBOARDING_STEPS.length;
  const done = ONBOARDING_STEPS.filter((s) => completedIds.includes(s.id)).length;
  const nextStep = ONBOARDING_STEPS.find((s) => !completedIds.includes(s.id));
  const allDone = done === total;

  return (
    <div className="overflow-hidden rounded-2xl border border-sky-200 shadow-sm dark:border-sky-900/50">
      {/* Header */}
      <div className="bg-gradient-to-r from-sky-600 to-sky-500 px-6 py-5">
        <div className="flex items-start justify-between gap-4">
          <div>
            <div className="flex items-center gap-2">
              <Zap className="h-4 w-4 text-sky-200" />
              <span className="text-xs font-semibold uppercase tracking-widest text-sky-200">
                Getting started
              </span>
            </div>
            <h2 className="mt-1 text-xl font-bold text-white">
              {allDone ? "You're all set!" : "Set up your first pipeline"}
            </h2>
            <p className="mt-1 text-sm text-sky-100">
              {allDone
                ? "All setup steps complete — your pipelines are ready to run."
                : "Complete these steps to get data flowing end-to-end."}
            </p>
          </div>
          <div className="flex shrink-0 items-center gap-3">
            <div className="rounded-full bg-white/20 px-3 py-1 text-xs font-semibold text-white">
              {done} / {total} done
            </div>
            <DismissOnboardingButton />
          </div>
        </div>
        {/* Progress bar */}
        <div className="mt-4 h-1.5 overflow-hidden rounded-full bg-white/20">
          <div
            className="h-full rounded-full bg-white transition-all duration-700"
            style={{ width: `${Math.round((done / total) * 100)}%` }}
          />
        </div>
      </div>

      {/* Step cards */}
      <div className="grid divide-y divide-slate-100 bg-white dark:divide-slate-800 dark:bg-slate-900 sm:grid-cols-5 sm:divide-x sm:divide-y-0">
        {ONBOARDING_STEPS.map((step, idx) => {
          const isComplete = completedIds.includes(step.id);
          const isPrimary = step.id === nextStep?.id;
          const Icon = STEP_ICONS[step.id] ?? ArrowRight;

          return (
            <Link
              key={step.id}
              href={step.href}
              className={`group relative flex flex-col gap-3 p-4 transition ${
                isComplete
                  ? "opacity-60 hover:opacity-80"
                  : isPrimary
                    ? "hover:bg-sky-50 dark:hover:bg-sky-950/30"
                    : "hover:bg-slate-50 dark:hover:bg-slate-800/30"
              }`}
            >
              {/* Primary step accent bar */}
              {isPrimary && (
                <div className="absolute inset-x-0 top-0 h-0.5 rounded-t-none bg-sky-600" />
              )}

              {/* Icon + step number */}
              <div className="flex items-center justify-between">
                <div
                  className={`flex h-8 w-8 items-center justify-center rounded-lg ${
                    isComplete
                      ? "bg-emerald-100 dark:bg-emerald-900/40"
                      : isPrimary
                        ? "bg-sky-600"
                        : "bg-slate-100 dark:bg-slate-800"
                  }`}
                >
                  {isComplete ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 dark:text-emerald-400" />
                  ) : (
                    <Icon
                      className={`h-4 w-4 ${
                        isPrimary ? "text-white" : "text-slate-500 dark:text-slate-400"
                      }`}
                    />
                  )}
                </div>
                <span
                  className={`text-[10px] font-medium ${
                    isComplete
                      ? "text-emerald-600 dark:text-emerald-400"
                      : "text-slate-400 dark:text-slate-500"
                  }`}
                >
                  Step {idx + 1}
                </span>
              </div>

              {/* Label + description */}
              <div className="flex-1">
                <p
                  className={`text-sm font-semibold leading-snug ${
                    isComplete
                      ? "text-slate-400 line-through dark:text-slate-500"
                      : "text-slate-900 dark:text-slate-100"
                  }`}
                >
                  {step.label}
                </p>
                <p className="mt-0.5 text-xs leading-snug text-slate-500 dark:text-slate-400">
                  {step.description}
                </p>
              </div>

              {/* CTA */}
              {!isComplete && (
                <div
                  className={`inline-flex items-center gap-1 text-xs font-semibold ${
                    isPrimary
                      ? "text-sky-600 dark:text-sky-400"
                      : "text-slate-400 group-hover:text-slate-600 dark:text-slate-500 dark:group-hover:text-slate-300"
                  }`}
                >
                  {isPrimary ? "Start here" : "Go"} <ArrowRight className="h-3 w-3" />
                </div>
              )}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
