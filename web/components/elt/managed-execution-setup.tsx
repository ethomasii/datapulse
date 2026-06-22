"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Cloud, Loader2, AlertTriangle } from "lucide-react";

type SetupResponse = {
  customerLabel: string;
  computeTier: "active" | "demo" | "unconfigured";
  isStub: boolean;
  readyForRealRuns: boolean;
  customerMessage: string;
  orgCompute?: { mode: string; label: string; isolatedQueue: boolean } | null;
};

export function ManagedExecutionSetup() {
  const [data, setData] = useState<SetupResponse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch("/api/execution/setup");
        if (!res.ok) return;
        const json = (await res.json()) as SetupResponse;
        if (!cancelled) setData(json);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-slate-500 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" />
        Checking managed compute…
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="flex items-start gap-2">
          <Cloud className="mt-0.5 h-4 w-4 shrink-0 text-violet-600 dark:text-violet-400" aria-hidden />
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">Managed compute</p>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              {data.orgCompute?.isolatedQueue
                ? `${data.orgCompute.label}. Your organization’s runs are isolated from other customers.`
                : data.customerMessage}
            </p>
          </div>
        </div>
        {data.computeTier === "active" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Active
          </span>
        ) : data.computeTier === "demo" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Demo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Starting
          </span>
        )}
      </div>
    </div>
  );
}
