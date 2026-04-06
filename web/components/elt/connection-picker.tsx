"use client";

import { useEffect, useRef, useState } from "react";
import { Cable, Check, ChevronDown, Save } from "lucide-react";

export type StoredConnection = {
  id: string;
  name: string;
  connectionType: "source" | "destination";
  connector: string;
  config: Record<string, string>;
};

type Props = {
  /** "source" or "destination" */
  connectionType: "source" | "destination";
  /** The connector key of the current pipeline (e.g. "postgres", "snowflake") */
  connector: string;
  /** Called when user picks a saved connection — passes its non-secret config */
  onSelect: (config: Record<string, string>) => void;
  /** Current connection field values — used to pre-fill the "save" form */
  currentValues: Record<string, string>;
};

/**
 * Dropdown that shows saved connections matching the current connector.
 * Also lets the user save the current values as a new named connection.
 */
export function ConnectionPicker({ connectionType, connector, onSelect, currentValues }: Props) {
  const [connections, setConnections] = useState<StoredConnection[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [saveError, setSaveError] = useState("");
  const [saved, setSaved] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load all connections once
  useEffect(() => {
    if (loaded) return;
    setLoaded(true);
    fetch("/api/elt/connections")
      .then((r) => r.text())
      .then((t) => {
        if (!t) return;
        try {
          const data = JSON.parse(t);
          setConnections((data.connections as StoredConnection[]) ?? []);
        } catch {
          /* ignore */
        }
      });
  }, [loaded]);

  // Close dropdown on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
        setSaveOpen(false);
      }
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const matching = connections.filter(
    (c) => c.connectionType === connectionType && c.connector.toLowerCase() === connector.toLowerCase()
  );

  async function saveAsConnection(e: React.FormEvent) {
    e.preventDefault();
    if (!saveName.trim()) return;
    setSaving(true);
    setSaveError("");
    // Only save non-empty, non-secret-looking values
    const safeConfig: Record<string, string> = {};
    for (const [k, v] of Object.entries(currentValues)) {
      if (v && !k.toLowerCase().includes("password") && !k.toLowerCase().includes("token") &&
          !k.toLowerCase().includes("secret") && !k.toLowerCase().includes("key") &&
          !k.toLowerCase().includes("pem") && !k.toLowerCase().includes("cert")) {
        safeConfig[k] = v;
      }
    }
    try {
      const res = await fetch("/api/elt/connections", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: saveName.trim(),
          connectionType,
          connector,
          config: safeConfig,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setSaveError(data.error ?? "Failed to save");
        return;
      }
      setConnections((prev) => [data.connection as StoredConnection, ...prev]);
      setSaveOpen(false);
      setSaveName("");
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
    } finally {
      setSaving(false);
    }
  }

  const colorClass =
    connectionType === "source"
      ? "border-sky-200 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
      : "border-emerald-200 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200";

  return (
    <div ref={ref} className="relative flex items-center gap-2">
      {/* Connection picker button */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setOpen((v) => !v); setSaveOpen(false); }}
          className={`inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium transition ${colorClass}`}
        >
          <Cable className="h-3.5 w-3.5 shrink-0" />
          {matching.length > 0 ? `${matching.length} saved` : "Saved connections"}
          <ChevronDown className="h-3 w-3 shrink-0 opacity-60" />
        </button>

        {open && (
          <div className="absolute left-0 top-full z-50 mt-1 min-w-[220px] rounded-xl border border-slate-200 bg-white shadow-lg dark:border-slate-700 dark:bg-slate-900">
            {matching.length === 0 ? (
              <p className="px-3 py-2 text-xs text-slate-400 dark:text-slate-500">
                No saved {connectionType} connections for <strong>{connector}</strong>.
              </p>
            ) : (
              <ul className="py-1">
                {matching.map((c) => (
                  <li key={c.id}>
                    <button
                      type="button"
                      onClick={() => {
                        onSelect(c.config);
                        setOpen(false);
                      }}
                      className="flex w-full items-center gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800"
                    >
                      <Cable className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                      <span className="flex-1 font-medium text-slate-800 dark:text-white">{c.name}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            <div className="border-t border-slate-100 px-3 py-1.5 dark:border-slate-800">
              <a href="/connections" className="text-xs text-sky-600 hover:underline dark:text-sky-400">
                Manage connections →
              </a>
            </div>
          </div>
        )}
      </div>

      {/* Save as connection */}
      <div className="relative">
        <button
          type="button"
          onClick={() => { setSaveOpen((v) => !v); setOpen(false); }}
          title="Save current values as a named connection"
          className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-medium text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:bg-slate-800"
        >
          {saved ? <Check className="h-3.5 w-3.5 text-emerald-500" /> : <Save className="h-3.5 w-3.5" />}
          {saved ? "Saved!" : "Save as connection"}
        </button>

        {saveOpen && (
          <form
            onSubmit={saveAsConnection}
            className="absolute right-0 top-full z-50 mt-1 w-64 rounded-xl border border-slate-200 bg-white p-3 shadow-lg dark:border-slate-700 dark:bg-slate-900"
          >
            <p className="mb-2 text-xs font-semibold text-slate-700 dark:text-slate-300">
              Save as connection
            </p>
            <p className="mb-2 text-[11px] text-slate-500 dark:text-slate-400">
              Passwords and secrets are excluded automatically.
            </p>
            {saveError && (
              <p className="mb-2 text-[11px] text-red-600 dark:text-red-400">{saveError}</p>
            )}
            <input
              value={saveName}
              onChange={(e) => setSaveName(e.target.value)}
              placeholder={`e.g. ${connector}-prod`}
              required
              className="w-full rounded border border-slate-200 bg-slate-50 px-2 py-1.5 font-mono text-xs dark:border-slate-700 dark:bg-slate-950 dark:text-white"
            />
            <div className="mt-2 flex gap-2">
              <button
                type="submit"
                disabled={saving || !saveName.trim()}
                className="flex-1 rounded bg-sky-600 px-2 py-1 text-xs font-semibold text-white hover:bg-sky-500 disabled:opacity-50"
              >
                {saving ? "Saving…" : "Save"}
              </button>
              <button
                type="button"
                onClick={() => { setSaveOpen(false); setSaveError(""); }}
                className="rounded border border-slate-200 px-2 py-1 text-xs text-slate-600 hover:bg-slate-50 dark:border-slate-700 dark:text-slate-300"
              >
                Cancel
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
