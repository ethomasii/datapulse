"use client";

import Link from "next/link";
import { Database, Settings2 } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";

type WorkspaceLakeBannerProps = {
  connector: string;
  name: string | null;
  variant?: "info" | "compact";
};

/** Shows the workspace default warehouse — Lakeflow-style “your lake” context. */
export function WorkspaceLakeBanner({
  connector,
  name,
  variant = "info",
}: WorkspaceLakeBannerProps) {
  const label = name?.trim() || connector;

  if (variant === "compact") {
    return (
      <p className="flex flex-wrap items-center gap-1.5 text-xs text-slate-600 dark:text-slate-400">
        <Database className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
        <span>Data lands in</span>
        <ConnectorIcon slug={connector} name={label} size={14} />
        <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
        <Link
          href="/connections"
          className="text-sky-600 hover:underline dark:text-sky-400"
        >
          Change
        </Link>
      </p>
    );
  }

  return (
    <div className="rounded-xl border border-sky-200 bg-sky-50/80 px-4 py-3 dark:border-sky-900/50 dark:bg-sky-950/30">
      <div className="flex flex-wrap items-start gap-3">
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-sky-600 text-white">
          <Database className="h-4 w-4" aria-hidden />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold text-slate-900 dark:text-white">
            Default warehouse
          </p>
          <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
            Ingest and transforms target
            <ConnectorIcon slug={connector} name={label} size={16} />
            <span className="font-medium text-slate-800 dark:text-slate-200">{label}</span>
          </p>
        </div>
        <Link
          href="/connections"
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-700 hover:underline dark:text-sky-300"
        >
          <Settings2 className="h-3.5 w-3.5" aria-hidden />
          Manage
        </Link>
      </div>
    </div>
  );
}
