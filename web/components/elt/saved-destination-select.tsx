"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Cable } from "lucide-react";

type StoredConnection = {
  id: string;
  name: string;
  connectionType: "source" | "destination";
  connector: string;
};

type Props = {
  value: string | null;
  onChange: (id: string | null) => void;
  label?: string;
};

export function SavedDestinationSelect({ value, onChange, label = "Destination connection" }: Props) {
  const [connections, setConnections] = useState<StoredConnection[]>([]);

  useEffect(() => {
    void fetch("/api/elt/connections", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((d: { connections?: StoredConnection[] }) => {
        setConnections((d.connections ?? []).filter((c) => c.connectionType === "destination"));
      })
      .catch(() => {});
  }, []);

  const selected = connections.find((c) => c.id === value);

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <label className="text-sm font-medium text-slate-700 dark:text-slate-300">{label}</label>
        <Link href="/connections" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
          Manage connections →
        </Link>
      </div>
      {connections.length === 0 ? (
        <p className="text-xs text-slate-500">
          No destination connections yet.{" "}
          <Link href="/connections" className="text-sky-600 hover:underline">
            Add one
          </Link>
        </p>
      ) : (
        <select
          value={value ?? ""}
          onChange={(e) => onChange(e.target.value || null)}
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
        >
          <option value="">— select warehouse connection —</option>
          {connections.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name} ({c.connector})
            </option>
          ))}
        </select>
      )}
      {selected ? (
        <div className="flex items-center gap-1.5 rounded-lg border border-emerald-300 bg-emerald-50 px-2.5 py-1.5 text-xs font-medium text-emerald-800 dark:border-emerald-700 dark:bg-emerald-950/30 dark:text-emerald-200">
          <Cable className="h-3.5 w-3.5 shrink-0" />
          {selected.name} · {selected.connector}
        </div>
      ) : null}
    </div>
  );
}
