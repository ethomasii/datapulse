"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Circle, Loader2, AlertTriangle } from "lucide-react";

type Check = {
  id: string;
  label: string;
  ok: boolean;
  required: boolean;
  hint?: string;
};

type SetupResponse = {
  mode: string;
  isStub: boolean;
  readyForRealRuns: boolean;
  checks: Check[];
  githubRepo: string | null;
  controlPlaneUrl: string | null;
  setup?: {
    vercel: { key: string; value: string; note?: string }[];
    githubActions: { key: string; value: string }[];
  };
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
        Checking managed execution setup…
      </div>
    );
  }

  if (!data) return null;

  const modeLabel =
    data.mode === "gha"
      ? "GitHub Actions"
      : data.mode === "stub"
        ? "Demo (stub)"
        : data.mode;

  return (
    <div className="rounded-lg border border-slate-200 bg-slate-50/80 p-4 dark:border-slate-700 dark:bg-slate-900/40">
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-slate-900 dark:text-white">Production execution</p>
          <p className="text-xs text-slate-600 dark:text-slate-400">
            Mode: <span className="font-medium">{modeLabel}</span>
            {data.controlPlaneUrl ? ` · ${data.controlPlaneUrl}` : ""}
          </p>
        </div>
        {data.readyForRealRuns ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-medium text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" />
            Ready for real runs
          </span>
        ) : data.isStub ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Stub mode — runs complete instantly for demo
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-medium text-amber-900 dark:bg-amber-900/40 dark:text-amber-100">
            <AlertTriangle className="h-3.5 w-3.5" />
            Incomplete setup
          </span>
        )}
      </div>

      <ul className="space-y-2 text-sm">
        {data.checks.map((c) => (
          <li key={c.id} className="flex gap-2">
            {c.ok ? (
              <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" />
            ) : (
              <Circle className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
            )}
            <div>
              <span className={c.ok ? "text-slate-700 dark:text-slate-300" : "text-slate-900 dark:text-white"}>
                {c.label}
                {c.required && !c.ok ? " (required)" : ""}
              </span>
              {c.hint && !c.ok ? (
                <p className="text-xs text-slate-500 dark:text-slate-400">{c.hint}</p>
              ) : null}
            </div>
          </li>
        ))}
      </ul>

      {!data.readyForRealRuns && data.setup ? (
        <details className="mt-4 text-xs text-slate-600 dark:text-slate-400">
          <summary className="cursor-pointer font-medium text-slate-800 dark:text-slate-200">
            Environment checklist
          </summary>
          <div className="mt-2 grid gap-4 sm:grid-cols-2">
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">Vercel</p>
              <ul className="space-y-1 font-mono">
                {data.setup.vercel.map((v) => (
                  <li key={v.key}>
                    {v.key}={v.value}
                  </li>
                ))}
              </ul>
            </div>
            <div>
              <p className="mb-1 font-medium text-slate-700 dark:text-slate-300">GitHub Actions secrets</p>
              <ul className="space-y-1 font-mono">
                {data.setup.githubActions.map((v) => (
                  <li key={v.key}>
                    {v.key}={v.value}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </details>
      ) : null}
    </div>
  );
}
