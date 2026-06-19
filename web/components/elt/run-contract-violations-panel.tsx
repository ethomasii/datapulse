"use client";

import Link from "next/link";
import { AlertTriangle } from "lucide-react";
import type { ContractViolationSummary } from "@/lib/elt/run-telemetry";

export function RunContractViolationsPanel({ violations }: { violations: ContractViolationSummary[] }) {
  if (!violations.length) return null;

  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/80 px-4 py-3 dark:border-amber-900/50 dark:bg-amber-950/30">
      <p className="inline-flex items-center gap-2 text-sm font-semibold text-amber-950 dark:text-amber-100">
        <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden />
        Data contract violations ({violations.length})
      </p>
      <ul className="mt-2 space-y-2 text-sm text-amber-900 dark:text-amber-100">
        {violations.map((v) => (
          <li key={`${v.contractSlug}-${v.assetKey}`} className="rounded-lg border border-amber-200/80 bg-white/60 px-3 py-2 dark:border-amber-900/40 dark:bg-black/20">
            <p className="font-medium">
              {v.contractName}{" "}
              <span className="font-mono text-xs text-amber-800 dark:text-amber-200">
                {v.assetKey.split(":").pop()}
              </span>
            </p>
            <ul className="mt-1 list-inside list-disc text-xs text-amber-800 dark:text-amber-200">
              {v.issues.map((issue) => (
                <li key={issue}>{issue}</li>
              ))}
            </ul>
          </li>
        ))}
      </ul>
      <p className="mt-2 text-xs text-amber-800 dark:text-amber-200">
        <Link href="/catalog/contracts" className="font-semibold hover:underline">
          Manage contracts →
        </Link>
      </p>
    </div>
  );
}
