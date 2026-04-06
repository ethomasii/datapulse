"use client";

import { useCallback, useState } from "react";

export function buildEnvFromValues(values: Record<string, string>): string {
  const lines = ["# Pipeline connection variables", ""];
  for (const [k, v] of Object.entries(values)) {
    lines.push(v.trim() !== "" ? `${k}=${v}` : `${k}=`);
  }
  return lines.join("\n");
}

export function CopyEnvButton({ values, className = "" }: { values: Record<string, string>; className?: string }) {
  const [copied, setCopied] = useState(false);
  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(buildEnvFromValues(values));
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      setCopied(false);
    }
  }, [values]);
  return (
    <button
      type="button"
      onClick={() => void copy()}
      className={`rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-100 dark:hover:bg-slate-700 ${className}`}
    >
      {copied ? "Copied" : "Copy .env from form"}
    </button>
  );
}
