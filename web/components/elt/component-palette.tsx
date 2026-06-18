"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Loader2, Search } from "lucide-react";
import { ELTPULSE_COMPONENT_DRAG_MIME } from "@/lib/elt/canvas-drag";
import { ComponentIcon } from "@/components/elt/component-icon";

export type ComponentListItem = {
  id: string;
  name: string;
  category: string;
  description: string;
  compileTarget: string;
  compileBadge?: string;
  compileHint: string;
  canvasPorts: { left: boolean; right: boolean };
  isNative?: boolean;
  isPackage?: boolean;
  hasCompiler?: boolean;
  compilerTier?: "native" | "category" | "schema" | "none";
  isExecutable?: boolean;
  compilerTierHint?: string;
  icon?: string;
  monitorPair?: { monitorId: string; pipelineComponentId: string; label: string } | null;
};

type Props = {
  onSelect: (component: ComponentListItem) => void;
  categoryFilter?: string;
  compileTargetFilter?: string;
  className?: string;
};

const PALETTE_TABS = [
  { id: "", label: "All" },
  { id: "ingestion", label: "Ingest" },
  { id: "transformation", label: "Transform" },
  { id: "check", label: "Check" },
  { id: "sensor", label: "Sensor" },
] as const;

/** Searchable palette fed by GET /api/elt/components — builder + canvas. */
export function ComponentPalette({ onSelect, categoryFilter, compileTargetFilter, className }: Props) {
  const [q, setQ] = useState("");
  const [category, setCategory] = useState(categoryFilter ?? "");
  const [executableOnly, setExecutableOnly] = useState(true);
  const [loading, setLoading] = useState(true);
  const [items, setItems] = useState<ComponentListItem[]>([]);
  const [categories, setCategories] = useState<{ category: string; count: number }[]>([]);
  const [total, setTotal] = useState(0);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams({ limit: "60", includePackages: "1" });
      if (executableOnly) params.set("executableOnly", "1");
      if (q.trim()) params.set("q", q.trim());
      if (category) params.set("category", category);
      if (compileTargetFilter) params.set("compileTarget", compileTargetFilter);
      const res = await fetch(`/api/elt/components?${params}`, { credentials: "same-origin" });
      if (!res.ok) return;
      const data = (await res.json()) as {
        components: ComponentListItem[];
        total: number;
        categories: { category: string; count: number }[];
      };
      setItems(data.components ?? []);
      setTotal(data.total ?? 0);
      setCategories(data.categories ?? []);
    } finally {
      setLoading(false);
    }
  }, [q, category, compileTargetFilter, executableOnly]);

  useEffect(() => {
    const t = setTimeout(() => void load(), 200);
    return () => clearTimeout(t);
  }, [load]);

  const badgeColor = useMemo(
    () =>
      ({
        dlt: "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
        sling: "bg-sky-100 text-sky-800 dark:bg-sky-950 dark:text-sky-200",
        quality: "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200",
        monitor: "bg-violet-100 text-violet-800 dark:bg-violet-950 dark:text-violet-200",
        dbt: "bg-indigo-100 text-indigo-800 dark:bg-indigo-950 dark:text-indigo-200",
        python: "bg-orange-100 text-orange-800 dark:bg-orange-950 dark:text-orange-200",
        dagster: "bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-200",
      }) as Record<string, string>,
    []
  );

  return (
    <div className={className ?? "flex h-full flex-col rounded-lg border border-slate-200 bg-white dark:border-slate-700 dark:bg-slate-900"}>
      <div className="border-b border-slate-200 p-3 dark:border-slate-700">
        <p className="text-sm font-semibold text-slate-900 dark:text-white">Component catalog</p>
        <p className="mt-0.5 text-xs text-slate-500">
          {executableOnly
            ? `${total} executable components — faithful compilers only`
            : `${total} templates — drag onto canvas or click to add`}
        </p>
        <label className="mt-2 flex cursor-pointer items-center gap-2 text-xs text-slate-600 dark:text-slate-400">
          <input
            type="checkbox"
            checked={executableOnly}
            onChange={(e) => setExecutableOnly(e.target.checked)}
            className="rounded border-slate-300"
          />
          Executable only (hide schema-only templates)
        </label>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-2 h-4 w-4 text-slate-400" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search components…"
            className="w-full rounded-md border border-slate-200 py-1.5 pl-8 pr-2 text-sm dark:border-slate-600 dark:bg-slate-950"
          />
        </div>
        <div className="mt-2 flex flex-wrap gap-1">
          {PALETTE_TABS.map((tab) => (
            <button
              key={tab.id || "all"}
              type="button"
              onClick={() => setCategory(tab.id)}
              className={`rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                category === tab.id
                  ? "bg-sky-600 text-white"
                  : "bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
        {categories.length > 0 && category === "" ? (
          <p className="mt-1.5 text-[10px] text-slate-400">
            {categories.map((c) => `${c.category} (${c.count})`).join(" · ")}
          </p>
        ) : null}
      </div>
      <ul className="flex-1 overflow-y-auto p-2">
        {loading ? (
          <li className="flex justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </li>
        ) : items.length === 0 ? (
          <li className="py-6 text-center text-sm text-slate-500">No components match</li>
        ) : (
          items.map((c) => (
            <li key={c.id}>
              <button
                type="button"
                draggable
                onDragStart={(e) => {
                  e.dataTransfer.setData(ELTPULSE_COMPONENT_DRAG_MIME, JSON.stringify(c));
                  e.dataTransfer.effectAllowed = "copy";
                }}
                onClick={() => onSelect(c)}
                className="mb-1 w-full cursor-grab rounded-md px-2 py-2 text-left hover:bg-slate-50 active:cursor-grabbing dark:hover:bg-slate-800"
              >
                <div className="flex items-start gap-2">
                  <ComponentIcon
                    componentId={c.id}
                    category={c.category}
                    manifestIcon={c.icon}
                    compileTarget={c.compileTarget}
                    size="sm"
                    className="mt-0.5 text-slate-500"
                  />
                  <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-sm font-medium text-slate-900 dark:text-white">{c.name}</span>
                  <div className="flex shrink-0 flex-col items-end gap-0.5">
                    {c.isExecutable ? (
                      <span className="rounded bg-emerald-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-emerald-800 dark:bg-emerald-900/50 dark:text-emerald-200">
                        {c.isPackage ? "package" : c.isNative ? "native" : "executable"}
                      </span>
                    ) : c.compilerTier === "category" ? (
                      <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase text-amber-900 dark:bg-amber-900/40 dark:text-amber-200">
                        category
                      </span>
                    ) : c.compilerTier === "schema" ? (
                      <span className="rounded bg-slate-200 px-1.5 py-0.5 text-[9px] font-bold uppercase text-slate-600 dark:bg-slate-700 dark:text-slate-300">
                        schema
                      </span>
                    ) : null}
                    <span
                      className={`rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase ${badgeColor[c.compileTarget] ?? "bg-slate-100 text-slate-600"}`}
                    >
                      {c.compileTarget}
                    </span>
                  </div>
                </div>
                <p className="mt-0.5 line-clamp-2 text-xs text-slate-500">{c.description || c.compileHint}</p>
                {c.monitorPair ? (
                  <p className="mt-1 text-[10px] text-violet-600 dark:text-violet-300">↔ {c.monitorPair.label}</p>
                ) : null}
                  </div>
                </div>
              </button>
            </li>
          ))
        )}
      </ul>
    </div>
  );
}
