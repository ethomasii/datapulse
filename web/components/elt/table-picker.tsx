"use client";

import { useEffect, useMemo, useState } from "react";
import { Loader2, Search, Table2 } from "lucide-react";
import type { DiscoverItem } from "@/lib/elt/source-discover";

export type TablePickerProps = {
  items: DiscoverItem[];
  selected: Set<string>;
  onChange: (selected: Set<string>) => void;
  loading?: boolean;
  message?: string;
  emptyHint?: string;
};

export function TablePicker({
  items,
  selected,
  onChange,
  loading,
  message,
  emptyHint,
}: TablePickerProps) {
  const [filter, setFilter] = useState("");

  const filtered = useMemo(() => {
    const q = filter.trim().toLowerCase();
    if (!q) return items;
    return items.filter(
      (i) =>
        i.name.toLowerCase().includes(q) ||
        i.id.toLowerCase().includes(q) ||
        (i.schema?.toLowerCase().includes(q) ?? false)
    );
  }, [items, filter]);

  useEffect(() => {
    if (selected.size === 0 && items.length > 0) {
      /* parent should set defaults */
    }
  }, [items, selected.size]);

  function toggle(id: string) {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(next);
  }

  function selectAll() {
    onChange(new Set(filtered.map((i) => i.id)));
  }

  function clearAll() {
    onChange(new Set());
  }

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-slate-200 dark:border-slate-700 px-4 py-8 text-sm text-slate-600 dark:text-slate-400">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
        Discovering tables and resources…
      </div>
    );
  }

  if (!items.length) {
    return (
      <div className="rounded-lg border border-dashed border-slate-300 dark:border-slate-600 px-4 py-6 text-sm text-slate-600 dark:text-slate-400">
        {emptyHint ?? message ?? "No discoverable objects — defaults will be used."}
      </div>
    );
  }

  return (
    <div className="space-y-3">
      {message ? <p className="text-sm text-slate-600 dark:text-slate-400">{message}</p> : null}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative min-w-[12rem] flex-1">
          <Search className="pointer-events-none absolute left-2.5 top-2.5 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder="Filter tables…"
            className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 py-2 pl-9 pr-3 text-sm dark:text-white"
          />
        </div>
        <button
          type="button"
          onClick={selectAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-600"
        >
          Select all
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="rounded-lg border border-slate-300 px-3 py-2 text-xs font-medium dark:border-slate-600"
        >
          Clear
        </button>
        <span className="text-xs text-slate-500">{selected.size} selected</span>
      </div>
      <ul className="max-h-64 overflow-y-auto rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
        {filtered.map((item) => (
          <li key={item.id}>
            <label className="flex cursor-pointer items-start gap-3 px-3 py-2.5 hover:bg-slate-50 dark:hover:bg-slate-800/50">
              <input
                type="checkbox"
                checked={selected.has(item.id)}
                onChange={() => toggle(item.id)}
                className="mt-1 rounded border-slate-300"
              />
              <span className="min-w-0 flex-1">
                <span className="flex items-center gap-2 text-sm font-medium text-slate-900 dark:text-white">
                  <Table2 className="h-3.5 w-3.5 shrink-0 text-sky-600" aria-hidden />
                  {item.schema ? (
                    <>
                      <span className="text-slate-500 font-normal">{item.schema}.</span>
                      {item.name}
                    </>
                  ) : (
                    item.name
                  )}
                </span>
                {item.description ? (
                  <span className="mt-0.5 block text-xs text-slate-500">{item.description}</span>
                ) : null}
                {item.rowEstimate != null ? (
                  <span className="mt-0.5 block text-xs text-slate-400">~{item.rowEstimate.toLocaleString()} rows</span>
                ) : null}
              </span>
              <span className="shrink-0 rounded bg-slate-100 px-1.5 py-0.5 text-[10px] uppercase text-slate-500 dark:bg-slate-800">
                {item.kind}
              </span>
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Hook: discover source objects (inline credentials or connection id). */
export function useSourceDiscovery(options: {
  connector: string;
  secrets?: Record<string, string>;
  connectionId?: string | null;
  enabled?: boolean;
}) {
  const [items, setItems] = useState<DiscoverItem[]>([]);
  const [message, setMessage] = useState<string>("");
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (options.enabled === false) return;
    let cancelled = false;

    async function run() {
      setLoading(true);
      setError(null);
      try {
        let res: Response;
        if (options.connectionId) {
          res = await fetch(`/api/elt/connections/${options.connectionId}/discover`, {
            credentials: "same-origin",
          });
        } else {
          res = await fetch("/api/elt/connections/discover", {
            method: "POST",
            credentials: "same-origin",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              connectionType: "source",
              connector: options.connector,
              config: {},
              secrets: options.secrets ?? {},
            }),
          });
        }
        const data = (await res.json()) as {
          ok?: boolean;
          message?: string;
          items?: DiscoverItem[];
          defaultSelected?: string[];
        };
        if (cancelled) return;
        if (!data.ok && !data.items?.length) {
          setError(data.message ?? "Discovery failed");
          setItems([]);
          return;
        }
        setItems(data.items ?? []);
        setMessage(data.message ?? "");
        const defaults = data.defaultSelected ?? data.items?.slice(0, 5).map((i) => i.id) ?? [];
        setSelected(new Set(defaults));
      } catch (e) {
        if (!cancelled) setError(e instanceof Error ? e.message : "Discovery failed");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [options.connector, options.connectionId, options.enabled]);

  return { items, message, loading, selected, setSelected, error };
}
