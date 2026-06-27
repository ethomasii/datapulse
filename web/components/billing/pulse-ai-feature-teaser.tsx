"use client";

import Link from "next/link";
import { Bot, Lock, Sparkles } from "lucide-react";
import clsx from "clsx";
import { BillingUpgradeButton } from "@/components/account/billing-upgrade-button";
import { PlanGatePill } from "@/components/account/plan-gate-pill";
import {
  PULSE_AI_CAPABILITIES,
  PULSE_AI_EXAMPLE_PROMPTS,
  PULSE_AI_NAME,
  PULSE_AI_TEAM_GATE_MESSAGE,
} from "@/lib/brand/pulse-ai";

/** Discoverable upgrade surface — shows what Pulse AI does before Team checkout. */
export function PulseAiFeatureTeaser({
  variant = "panel",
  className,
}: {
  variant?: "panel" | "compact" | "dark";
  className?: string;
}) {
  const isDark = variant === "dark";
  const isCompact = variant === "compact";

  return (
    <div
      className={clsx(
        "rounded-xl border",
        isDark
          ? "border-slate-700 bg-slate-800/80 text-slate-200"
          : "border-teal-200/80 bg-gradient-to-br from-teal-50/90 to-sky-50/50 dark:border-teal-900 dark:from-teal-950/40 dark:to-sky-950/20",
        className
      )}
    >
      <div className={clsx("flex items-start gap-3", isCompact ? "p-3" : "p-4")}>
        <div
          className={clsx(
            "flex shrink-0 items-center justify-center rounded-full",
            isCompact ? "h-8 w-8" : "h-9 w-9",
            isDark ? "bg-gradient-to-br from-teal-600 to-sky-600" : "bg-gradient-to-br from-teal-500 to-sky-500"
          )}
        >
          {isDark ? <Bot className="h-4 w-4 text-white" /> : <Sparkles className="h-4 w-4 text-white" />}
        </div>
        <div className="min-w-0 flex-1 space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className={clsx("font-semibold", isDark ? "text-white" : "text-slate-900 dark:text-white")}>
              {PULSE_AI_NAME}
            </h3>
            <PlanGatePill minTier="team" />
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-700 dark:text-amber-300">
              <Lock className="h-3 w-3" aria-hidden />
              Team feature
            </span>
          </div>

          {!isCompact ? (
            <p className={clsx("text-sm", isDark ? "text-slate-300" : "text-slate-600 dark:text-slate-400")}>
              {PULSE_AI_TEAM_GATE_MESSAGE}
            </p>
          ) : null}

          {!isCompact ? (
            <ul className={clsx("space-y-1 text-xs", isDark ? "text-slate-400" : "text-slate-600 dark:text-slate-400")}>
              {PULSE_AI_CAPABILITIES.map((item) => (
                <li key={item} className="flex gap-2">
                  <span className="text-teal-500" aria-hidden>
                    •
                  </span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          ) : null}

          <div>
            <p
              className={clsx(
                "mb-1.5 text-[10px] font-semibold uppercase tracking-wide",
                isDark ? "text-slate-500" : "text-slate-500"
              )}
            >
              Example prompts
            </p>
            <div className="flex flex-wrap gap-1.5">
              {PULSE_AI_EXAMPLE_PROMPTS.map((prompt) => (
                <span
                  key={prompt}
                  className={clsx(
                    "rounded-full border px-2.5 py-1 text-[11px]",
                    isDark
                      ? "border-slate-600 bg-slate-900/60 text-slate-400"
                      : "border-teal-200/80 bg-white/80 text-slate-600 dark:border-teal-800 dark:bg-slate-900/60 dark:text-slate-400"
                  )}
                  title="Available on Team"
                >
                  {prompt}
                </span>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 pt-1">
            <BillingUpgradeButton
              tier="team"
              label="Upgrade to Team"
              className="inline-flex items-center gap-1.5 rounded-lg bg-violet-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-violet-500 disabled:opacity-50"
            />
            <Link
              href="/docs/ai-builder"
              className={clsx(
                "text-xs font-medium underline underline-offset-2",
                isDark ? "text-sky-300 hover:text-sky-200" : "text-sky-700 hover:text-sky-600 dark:text-sky-400"
              )}
            >
              Learn about {PULSE_AI_NAME}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
