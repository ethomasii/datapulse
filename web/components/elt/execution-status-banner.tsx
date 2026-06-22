"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { AlertTriangle } from "lucide-react";
import clsx from "clsx";

type ExecutionMode = {
  label: string;
  computeTier: "active" | "demo" | "unconfigured";
  isStub: boolean;
  readyForRealRuns: boolean;
  customerMessage?: string;
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

  if (loading || !data || data.readyForRealRuns) return null;

  if (data.computeTier !== "demo" && data.computeTier !== "unconfigured") return null;

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
        {data.computeTier === "demo" ? "Demo runs" : "Compute pending"}
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
          {data.computeTier === "demo" ? "Demo mode — runs are simulated" : "Managed compute not ready"}
        </p>
        <p className="mt-0.5 text-xs text-amber-900/90 dark:text-amber-200/90">
          {data.customerMessage ??
            (data.computeTier === "demo"
              ? "Pipeline runs complete with sample telemetry on this environment. Configure execution to move real data."
              : "This environment has not finished provisioning managed workers yet.")}
        </p>
      </div>
      <Link
        href="/gateway"
        className="shrink-0 rounded-lg bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-amber-500"
      >
        Execution settings →
      </Link>
    </div>
  );
}
