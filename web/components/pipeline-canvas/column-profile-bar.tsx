"use client";

import clsx from "clsx";
import type { ColumnProfile } from "@/lib/elt/warehouse-column-profile";

type Props = {
  profile?: ColumnProfile;
  className?: string;
};

function pct(value: number | undefined): string {
  if (value == null || !Number.isFinite(value)) return "—";
  if (value >= 10) return `${Math.round(value)}%`;
  return `${value.toFixed(1)}%`;
}

function NumericProfileBar({ profile }: { profile: ColumnProfile }) {
  const min = profile.min ?? profile.q25 ?? profile.q50 ?? 0;
  const max = profile.max ?? profile.q75 ?? profile.q50 ?? min + 1;
  const span = max - min || 1;
  const q25 = ((profile.q25 ?? min) - min) / span;
  const q75 = ((profile.q75 ?? max) - min) / span;
  const q50 = ((profile.q50 ?? profile.avg ?? (min + max) / 2) - min) / span;

  return (
    <div className="mt-1 space-y-0.5">
      <div className="relative h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="absolute inset-y-0 rounded-full bg-sky-300/80 dark:bg-sky-600/70"
          style={{ left: `${Math.max(0, q25 * 100)}%`, width: `${Math.max(4, (q75 - q25) * 100)}%` }}
        />
        <div
          className="absolute top-0 h-full w-0.5 bg-sky-700 dark:bg-sky-200"
          style={{ left: `${Math.max(0, Math.min(100, q50 * 100))}%` }}
          aria-hidden
        />
      </div>
      <p className="truncate text-[9px] leading-tight text-slate-500 dark:text-slate-400">
        {profile.q50 != null ? `med ${profile.q50}` : profile.avg != null ? `avg ${Math.round(profile.avg * 100) / 100}` : "numeric"}
        {profile.nullPct > 0 ? ` · ${pct(profile.nullPct)} null` : ""}
      </p>
    </div>
  );
}

function CategoricalProfileBar({ profile }: { profile: ColumnProfile }) {
  const fill = profile.topValueShare != null ? Math.round(profile.topValueShare * 100) : Math.max(0, 100 - profile.nullPct);

  return (
    <div className="mt-1 space-y-0.5">
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-700">
        <div
          className="h-full rounded-full bg-violet-400 dark:bg-violet-500"
          style={{ width: `${Math.max(4, Math.min(100, fill))}%` }}
        />
      </div>
      <p className="truncate text-[9px] leading-tight text-slate-500 dark:text-slate-400" title={profile.topValue}>
        {profile.topValue
          ? `${profile.topValue} (${Math.round((profile.topValueShare ?? 0) * 100)}%)`
          : profile.approxUnique != null
            ? `~${profile.approxUnique} unique`
            : "categorical"}
        {profile.nullPct > 0 ? ` · ${pct(profile.nullPct)} null` : ""}
      </p>
    </div>
  );
}

/** Compact column profile mini-chart under preview headers. */
export function ColumnProfileBar({ profile, className }: Props) {
  if (!profile) {
    return <div className={clsx("mt-1 h-[1.375rem]", className)} aria-hidden />;
  }

  return (
    <div className={clsx("font-normal", className)}>
      {profile.kind === "numeric" ? (
        <NumericProfileBar profile={profile} />
      ) : (
        <CategoricalProfileBar profile={profile} />
      )}
    </div>
  );
}
