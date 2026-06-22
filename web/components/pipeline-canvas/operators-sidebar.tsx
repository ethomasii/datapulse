"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Layers,
  Loader2,
  Search,
  Sparkles,
  Target,
  Workflow,
} from "lucide-react";
import clsx from "clsx";
import { ComponentIcon } from "@/components/elt/component-icon";
import { ELTPULSE_COMPONENT_DRAG_MIME } from "@/lib/elt/canvas-drag";
import type { ComponentListItem } from "@/components/elt/component-palette";

type Props = {
  onSelect: (component: ComponentListItem) => void;
  onAddSource?: () => void;
  onAddDestination?: () => void;
  className?: string;
};

const FEATURED_NATIVE_IDS = [
  "group_aggregate",
  "union_tables",
  "filter_rows",
  "join_tables",
  "limit_rows",
  "pivot",
  "data_cleansing",
  "drop_duplicates",
  "select_columns",
  "sort_rows",
  "fill_nulls",
  "replace_values",
] as const;

type Section = {
  id: string;
  title: string;
  icon: typeof Workflow;
  items: ComponentListItem[];
};

function OperatorRow({
  item,
  onSelect,
  onQuickAction,
  fallbackIcon,
}: {
  item: ComponentListItem | { id: string; name: string; description: string; action?: "source" | "dest" };
  onSelect: (c: ComponentListItem) => void;
  onQuickAction?: (action: "source" | "dest") => void;
  fallbackIcon?: typeof Database;
}) {
  const isQuick = "action" in item && (item.action === "source" || item.action === "dest");
  const Icon = fallbackIcon ?? Workflow;

  if (isQuick) {
    return (
      <button
        type="button"
        onClick={() => {
          if (item.action === "source") onQuickAction?.("source");
          if (item.action === "dest") onQuickAction?.("dest");
        }}
        className="flex w-full items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-slate-100 dark:hover:bg-slate-800"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-500" aria-hidden />
        <span className="min-w-0">
          <span className="block text-xs font-medium text-slate-900 dark:text-white">{item.name}</span>
          <span className="block text-[10px] leading-snug text-slate-500">{item.description}</span>
        </span>
      </button>
    );
  }

  const c = item as ComponentListItem;
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ELTPULSE_COMPONENT_DRAG_MIME, JSON.stringify(c));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onSelect(c)}
      className="flex w-full cursor-grab items-start gap-2 rounded-md px-2 py-1.5 text-left hover:bg-violet-50 active:cursor-grabbing dark:hover:bg-violet-950/30"
    >
      <ComponentIcon
        componentId={c.id}
        category={c.category}
        manifestIcon={c.icon}
        compileTarget={c.compileTarget}
        size="sm"
        className="mt-0.5 text-violet-600 dark:text-violet-300"
      />
      <span className="min-w-0">
        <span className="block text-xs font-medium text-slate-900 dark:text-white">{c.name}</span>
        <span className="block line-clamp-2 text-[10px] leading-snug text-slate-500">
          {c.description || c.compileHint}
        </span>
      </span>
    </button>
  );
}

/** Lakeflow-style left rail — grouped operators to drag onto the canvas. */
export function OperatorsSidebar({ onSelect, onAddSource, onAddDestination, className }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [nativeItems, setNativeItems] = useState<ComponentListItem[]>([]);
  const [checkItems, setCheckItems] = useState<ComponentListItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [nativeRes, checkRes] = await Promise.all([
        fetch("/api/elt/components?nativeOnly=1&executableOnly=1&category=transformation&limit=120", {
          credentials: "same-origin",
        }),
        fetch("/api/elt/components?nativeOnly=1&executableOnly=1&category=check&limit=40", {
          credentials: "same-origin",
        }),
      ]);
      if (nativeRes.ok) {
        const data = (await nativeRes.json()) as { components: ComponentListItem[] };
        setNativeItems(data.components ?? []);
      }
      if (checkRes.ok) {
        const data = (await checkRes.json()) as { components: ComponentListItem[] };
        setCheckItems(data.components ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const featured = useMemo(() => {
    const byId = new Map(nativeItems.map((c) => [c.id, c]));
    const ordered = FEATURED_NATIVE_IDS.map((id) => byId.get(id)).filter(Boolean) as ComponentListItem[];
    return ordered.length ? ordered : nativeItems.slice(0, 12);
  }, [nativeItems]);

  const filteredNative = useMemo(() => {
    const ql = q.trim().toLowerCase();
    if (!ql) return [];
    return nativeItems.filter(
      (c) =>
        c.id.toLowerCase().includes(ql) ||
        c.name.toLowerCase().includes(ql) ||
        c.description.toLowerCase().includes(ql)
    );
  }, [nativeItems, q]);

  const sections: Section[] = useMemo(
    () => [
      {
        id: "transforms",
        title: "Transformations (Native)",
        icon: Workflow,
        items: q.trim() ? filteredNative : featured,
      },
      ...(q.trim()
        ? []
        : [
            {
              id: "checks",
              title: "Data quality",
              icon: Sparkles,
              items: checkItems.slice(0, 8),
            },
          ]),
    ],
    [featured, filteredNative, checkItems, q]
  );

  function onQuickAction(action: "source" | "dest") {
    if (action === "source") onAddSource?.();
    else onAddDestination?.();
  }

  return (
    <aside
      className={clsx(
        "flex h-full min-h-0 flex-col border-r border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-950",
        className
      )}
      aria-label="Available operators"
    >
      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Available operators</p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search transforms…"
            className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {!q.trim() ? (
          <section className="mb-3">
            <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Layers className="h-3 w-3" aria-hidden />
              Source and output
            </h3>
            <OperatorRow
              item={{ id: "__source", name: "Source", description: "Import data into the pipeline", action: "source" }}
              onSelect={onSelect}
              onQuickAction={onQuickAction}
              fallbackIcon={Database}
            />
            <OperatorRow
              item={{ id: "__dest", name: "Output", description: "Land data in the warehouse", action: "dest" }}
              onSelect={onSelect}
              onQuickAction={onQuickAction}
              fallbackIcon={Target}
            />
          </section>
        ) : null}

        {loading ? (
          <div className="flex justify-center py-8 text-slate-400">
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden />
          </div>
        ) : (
          sections.map((section) => (
            <section key={section.id} className="mb-3">
              <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <section.icon className="h-3 w-3" aria-hidden />
                {section.title}
              </h3>
              {section.items.length === 0 ? (
                <p className="px-2 py-2 text-[11px] text-slate-500">No matches</p>
              ) : (
                section.items.map((c) => <OperatorRow key={c.id} item={c} onSelect={onSelect} />)
              )}
            </section>
          ))
        )}

        {!q.trim() && !loading && nativeItems.length > featured.length ? (
          <p className="px-2 py-1 text-[10px] text-slate-400">
            {nativeItems.length - featured.length} more — search to find them
          </p>
        ) : null}
      </div>
    </aside>
  );
}
