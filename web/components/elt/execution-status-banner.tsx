"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2 } from "lucide-react";
import clsx from "clsx";

type ExecutionMode = {
  mode: string;
  label: string;
  isStub: boolean;
  readyForRealRuns: boolean;
};

type Props = {
  className?: string;
  compact?: boolean;
};

export function ExecutionStatusBanner({ className, compact = false }: Props) {
  const [data, setData] = useState<ExecutionMode | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    fetch("/api/execution/mode", { credentials: "same-origin" })
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setData(json as ExecutionMode);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return compact ? null : (
      <div className={clsx("flex items-center gap-2 text-xs text-slate-500", className)}>
        <Loader2 className="h-3.5 w-3.5 animate-spin" aria-hidden />
        Checking execution mode…
      </div>
    );
  }

  if (!data) return null;
  if (data.readyForRealRuns && !compact) {
    return (
      <div
        className={clsx(
          "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-emerald-200 bg-emerald-50/80 px-4 py-3 text-sm dark:border-emerald-900/50 dark:bg-emerald-950/30",
          className
        )}
      >
        <span className="inline-flex items-center gap-2 font-medium text-emerald-900 dark:text-emerald-100">
          <CheckCircle2 className="h-4 w-4 shrink-0" aria-hidden />
          Production execution — {data.label}
        </span>
        <Link href="/gateway" className="text-xs font-semibold text-emerald-800 hover:underline dark:text-emerald-200">
          Gateway →
        </Link>
      </div>
    );
  }

  if (!data.isStub) return null;

  if (compact) {
    return (
      <Link
        href="/gateway"
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900 hover:bg-amber-200 dark:bg-amber-950/50 dark:text-amber-100",
          className
        )}
      >
        <AlertTriangle className="h-3 w-3" aria-hidden />
        Demo runs
      </Link>
    );
  }

  return (
    <div
      className={clsx(
        "flex flex-wrap items-center justify-between gap-3 rounded-xl border border-amber-200 bg-amber-50/90 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100",
        className
      )}
    >
      <div className="min-w-0">
        <p className="inline-flex items-center gap-2 font-semibold">
          <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
          Runs use demo telemetry
        </p>
        <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
          Configure GitHub Actions or a gateway for real extract/load. Demo mode still exercises runs, assets, and
          transforms.
        </p>
      </div>
      <Link
        href="/gateway"
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
      >
        Enable real execution
      </Link>
    </div>
  );
}
