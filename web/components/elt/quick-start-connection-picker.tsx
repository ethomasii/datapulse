"use client";

import Link from "next/link";
import { Cable, Plus } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";
import type { QuickStartConnection } from "@/lib/hooks/use-quick-start-connections";

type QuickStartConnectionPickerProps = {
  side: "source" | "destination";
  connector: string;
  connectorLabel: string;
  connections: QuickStartConnection[];
  mode: "reuse" | "new";
  selectedId: string | null;
  onModeChange: (mode: "reuse" | "new") => void;
  onSelectId: (id: string) => void;
};

export function QuickStartConnectionPicker({
  side,
  connector,
  connectorLabel,
  connections,
  mode,
  selectedId,
  onModeChange,
  onSelectId,
}: QuickStartConnectionPickerProps) {
  if (connections.length === 0) return null;

  return (
    <div className="rounded-xl border border-emerald-200 bg-emerald-50/70 p-4 dark:border-emerald-900/50 dark:bg-emerald-950/25">
      <p className="flex items-center gap-2 text-sm font-semibold text-emerald-950 dark:text-emerald-100">
        <Cable className="h-4 w-4 shrink-0" aria-hidden />
        Reuse a saved {side}
      </p>
      <p className="mt-1 text-xs text-emerald-900/90 dark:text-emerald-100/90">
        You already have {connectorLabel} connection{connections.length === 1 ? "" : "s"} with stored
        credentials — no need to paste a token again unless you want a different account.
      </p>

      <div className="mt-3 space-y-2">
        {connections.map((c) => (
          <label
            key={c.id}
            className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
              mode === "reuse" && selectedId === c.id
                ? "border-emerald-500 bg-white dark:border-emerald-600 dark:bg-emerald-950/40"
                : "border-emerald-200/80 bg-white/60 hover:border-emerald-300 dark:border-emerald-900 dark:bg-emerald-950/20"
            }`}
          >
            <input
              type="radio"
              name={`qs-${side}-connection`}
              checked={mode === "reuse" && selectedId === c.id}
              onChange={() => {
                onModeChange("reuse");
                onSelectId(c.id);
              }}
              className="mt-1"
            />
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                <ConnectorIcon slug={connector} name={connectorLabel} size={16} />
                {c.name}
              </span>
              <span className="mt-0.5 block font-mono text-[10px] text-slate-500">{c.id}</span>
            </span>
          </label>
        ))}

        <label
          className={`flex cursor-pointer items-start gap-3 rounded-lg border px-3 py-2.5 transition ${
            mode === "new"
              ? "border-sky-500 bg-white dark:border-sky-600 dark:bg-sky-950/40"
              : "border-slate-200 bg-white/60 hover:border-slate-300 dark:border-slate-700 dark:bg-slate-950/20"
          }`}
        >
          <input
            type="radio"
            name={`qs-${side}-connection`}
            checked={mode === "new"}
            onChange={() => onModeChange("new")}
            className="mt-1"
          />
          <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
            <Plus className="h-4 w-4 text-sky-600" aria-hidden />
            Add new credentials
          </span>
        </label>
      </div>

      <p className="mt-3 text-[11px] text-emerald-900/80 dark:text-emerald-200/80">
        Manage all connections on{" "}
        <Link href="/connections" className="font-medium underline hover:no-underline">
          Connections
        </Link>
        .
      </p>
    </div>
  );
}
