"use client";

import clsx from "clsx";
import { useMemo } from "react";
import type { ColumnProfile } from "@/lib/elt/warehouse-column-profile";
import {
  booleanShares,
  histogramBinHeights,
  profileChartKind,
  topValueShares,
} from "@/lib/elt/preview-row-utils";

type Props = {
  profile?: ColumnProfile;
  sampleValues?: unknown[];
  className?: string;
};

function pct(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

function MiniHistogram({ values, variant }: { values: unknown[]; variant: "numeric" | "date" }) {
  const bins = useMemo(() => histogramBinHeights(values, 10), [values]);
  return (
    <div
      className="mt-0.5 flex h-7 items-end gap-px rounded-sm bg-slate-100/80 p-0.5 dark:bg-slate-800/60"
      title={variant === "date" ? "Date distribution (sample)" : "Numeric distribution (sample)"}
    >
      {bins.map((h, i) => (
        <div
          key={i}
          className={clsx(
            "min-w-0 flex-1 rounded-[1px]",
            variant === "date" ? "bg-amber-400/90 dark:bg-amber-500/80" : "bg-sky-400/90 dark:bg-sky-500/80"
          )}
          style={{ height: `${Math.max(12, Math.round(h * 100))}%` }}
        />
      ))}
    </div>
  );
}

function CategoricalBars({ values }: { values: unknown[] }) {
  const tops = useMemo(() => topValueShares(values, 4), [values]);
  if (!tops.length) return null;
  return (
    <div className="mt-0.5 space-y-0.5">
      {tops.map((t) => (
        <div key={t.value} className="flex items-center gap-1">
          <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
            <div
              className="h-full rounded-full bg-violet-400 dark:bg-violet-500"
              style={{ width: `${Math.max(6, Math.round(t.share * 100))}%` }}
            />
          </div>
          <span className="max-w-[2.5rem] truncate text-[8px] text-slate-500" title={t.value}>
            {Math.round(t.share * 100)}%
          </span>
        </div>
      ))}
    </div>
  );
}

function BooleanBar({ values }: { values: unknown[] }) {
  const { trueShare, falseShare } = useMemo(() => booleanShares(values), [values]);
  return (
    <div className="mt-0.5 space-y-0.5">
      <div className="flex h-2 overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div className="h-full bg-emerald-400 dark:bg-emerald-500" style={{ width: `${trueShare * 100}%` }} />
        <div className="h-full bg-rose-300 dark:bg-rose-500/80" style={{ width: `${falseShare * 100}%` }} />
      </div>
      <p className="text-[9px] text-slate-500">
        true {Math.round(trueShare * 100)}% · false {Math.round(falseShare * 100)}%
      </p>
    </div>
  );
}

function NumericSummary({ profile }: { profile: ColumnProfile }) {
  const min = profile.min ?? profile.q25 ?? profile.q50 ?? 0;
  const max = profile.max ?? profile.q75 ?? profile.q50 ?? min + 1;
  const span = max - min || 1;
  const q25 = ((profile.q25 ?? min) - min) / span;
  const q75 = ((profile.q75 ?? max) - min) / span;
  const q50 = ((profile.q50 ?? profile.avg ?? (min + max) / 2) - min) / span;

  return (
    <p className="truncate text-[9px] leading-tight text-slate-500 dark:text-slate-400">
      {profile.min != null && profile.max != null ? `${profile.min}–${profile.max}` : "numeric"}
      {profile.q50 != null ? ` · med ${profile.q50}` : profile.avg != null ? ` · avg ${Math.round(profile.avg * 100) / 100}` : ""}
      {profile.nullPct > 0 ? ` · ${pct(profile.nullPct)} null` : ""}
      <span className="relative ml-1 inline-block h-1 w-8 align-middle overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <span
          className="absolute inset-y-0 rounded-full bg-sky-300/80 dark:bg-sky-600/70"
          style={{ left: `${q25 * 100}%`, width: `${Math.max(8, (q75 - q25) * 100)}%` }}
        />
        <span
          className="absolute top-0 h-full w-px bg-sky-800 dark:bg-sky-100"
          style={{ left: `${Math.max(0, Math.min(100, q50 * 100))}%` }}
        />
      </span>
    </p>
  );
}

/** Column profile mini-chart under preview headers (histogram / top values by type). */
export function ColumnProfileBar({ profile, sampleValues = [], className }: Props) {
  if (!profile) {
    return <div className={clsx("mt-1 h-[2.5rem]", className)} aria-hidden />;
  }

  const chartKind = profileChartKind(profile.type, sampleValues);
  const hasSample = sampleValues.some((v) => v != null && v !== "");

  return (
    <div className={clsx("font-normal", className)}>
      {hasSample && chartKind === "numeric" ? <MiniHistogram values={sampleValues} variant="numeric" /> : null}
      {hasSample && chartKind === "date" ? <MiniHistogram values={sampleValues} variant="date" /> : null}
      {hasSample && chartKind === "categorical" ? <CategoricalBars values={sampleValues} /> : null}
      {hasSample && chartKind === "boolean" ? <BooleanBar values={sampleValues} /> : null}
      {!hasSample && profile.kind === "numeric" ? (
        <div className="mt-0.5 h-7 rounded-sm bg-slate-100 dark:bg-slate-800/60" />
      ) : null}
      {chartKind === "numeric" || chartKind === "date" ? (
        <NumericSummary profile={profile} />
      ) : (
        <p className="truncate text-[9px] leading-tight text-slate-500 dark:text-slate-400" title={profile.topValue}>
          {profile.approxUnique != null ? `~${profile.approxUnique} unique` : profile.type || "text"}
          {profile.nullPct > 0 ? ` · ${pct(profile.nullPct)} null` : ""}
        </p>
      )}
    </div>
  );
}
