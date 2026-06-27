"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  Database,
  Layers,
  Loader2,
  Search,
  Target,
  Workflow,
} from "lucide-react";
import clsx from "clsx";
import { ComponentIcon } from "@/components/elt/component-icon";
import { ELTPULSE_COMPONENT_DRAG_MIME } from "@/lib/elt/canvas-drag";
import type { ComponentListItem } from "@/components/elt/component-palette";
import {
  filterCanvasOperatorPaletteSections,
  groupCanvasOperatorPalette,
} from "@/lib/elt/canvas-operator-palette-groups";
import { filterCanvasOperatorComponents } from "@/lib/elt/canvas-operator-scope";

type Props = {
  onSelect: (component: ComponentListItem) => void;
  onAddSource?: () => void;
  onAddDestination?: () => void;
  className?: string;
};

const PALETTE_FETCH_LIMIT = 500;

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
  const isAi = c.category === "ai";
  return (
    <button
      type="button"
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(ELTPULSE_COMPONENT_DRAG_MIME, JSON.stringify(c));
        e.dataTransfer.effectAllowed = "copy";
      }}
      onClick={() => onSelect(c)}
      className={clsx(
        "flex w-full cursor-grab items-start gap-2 rounded-md px-2 py-1.5 text-left active:cursor-grabbing",
        isAi ? "hover:bg-fuchsia-50 dark:hover:bg-fuchsia-950/30" : "hover:bg-violet-50 dark:hover:bg-violet-950/30"
      )}
    >
      <ComponentIcon
        componentId={c.id}
        category={c.category}
        manifestIcon={c.icon}
        compileTarget={c.compileTarget}
        size="sm"
        className={clsx(
          "mt-0.5",
          isAi ? "text-fuchsia-600 dark:text-fuchsia-300" : "text-violet-600 dark:text-violet-300"
        )}
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

/** Left rail — full transform & AI palette grouped by capability. */
export function OperatorsSidebar({ onSelect, onAddSource, onAddDestination, className }: Props) {
  const [q, setQ] = useState("");
  const [loading, setLoading] = useState(true);
  const [transformItems, setTransformItems] = useState<ComponentListItem[]>([]);
  const [aiItems, setAiItems] = useState<ComponentListItem[]>([]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [transformRes, aiRes] = await Promise.all([
        fetch(
          `/api/elt/components?nativeOnly=1&executableOnly=1&category=transformation&limit=${PALETTE_FETCH_LIMIT}`,
          { credentials: "same-origin" }
        ),
        fetch(
          `/api/elt/components?nativeOnly=1&executableOnly=1&category=ai&limit=${PALETTE_FETCH_LIMIT}`,
          { credentials: "same-origin" }
        ),
      ]);
      if (transformRes.ok) {
        const data = (await transformRes.json()) as { components: ComponentListItem[] };
        setTransformItems(filterCanvasOperatorComponents(data.components ?? []));
      }
      if (aiRes.ok) {
        const data = (await aiRes.json()) as { components: ComponentListItem[] };
        setAiItems(data.components ?? []);
      }
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const paletteSections = useMemo(
    () => groupCanvasOperatorPalette(transformItems, aiItems),
    [transformItems, aiItems]
  );

  const sections = useMemo(
    () => filterCanvasOperatorPaletteSections(paletteSections, q),
    [paletteSections, q]
  );

  const totalOperators = transformItems.length + aiItems.length;

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
      aria-label="Asset operators"
    >
      <div className="shrink-0 border-b border-slate-200 p-3 dark:border-slate-800">
        <p className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Asset operators</p>
        <p className="mt-0.5 text-[9px] leading-snug text-slate-400">
          {loading
            ? "Loading catalog…"
            : `${totalOperators} transforms & AI steps — drag onto the canvas or click to add.`}
        </p>
        <div className="relative mt-2">
          <Search className="pointer-events-none absolute left-2 top-2 h-3.5 w-3.5 text-slate-400" aria-hidden />
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Narrow the list…"
            className="w-full rounded-md border border-slate-200 py-1.5 pl-7 pr-2 text-xs dark:border-slate-700 dark:bg-slate-900"
          />
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-2">
        {!q.trim() ? (
          <section className="mb-3">
            <h3 className="mb-1 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
              <Layers className="h-3 w-3" aria-hidden />
              EL nodes
            </h3>
            <OperatorRow
              item={{ id: "__source", name: "Source", description: "EL extract — connectors & run slices", action: "source" }}
              onSelect={onSelect}
              onQuickAction={onQuickAction}
              fallbackIcon={Database}
            />
            <OperatorRow
              item={{ id: "__dest", name: "Output", description: "EL load — warehouse destination", action: "dest" }}
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
        ) : sections.length === 0 ? (
          <p className="px-2 py-4 text-[11px] text-slate-500">No operators match your search.</p>
        ) : (
          sections.map((section) => (
            <section key={section.id} className="mb-3">
              <h3 className="mb-0.5 flex items-center gap-1.5 px-1 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
                <Workflow className="h-3 w-3 shrink-0" aria-hidden />
                {section.title}
                <span className="font-normal normal-case text-slate-400">({section.items.length})</span>
              </h3>
              {section.subtitle ? (
                <p className="mb-1 px-1 text-[9px] leading-snug text-slate-400">{section.subtitle}</p>
              ) : null}
              {section.items.map((c) => (
                <OperatorRow key={c.id} item={c} onSelect={onSelect} />
              ))}
            </section>
          ))
        )}
      </div>
    </aside>
  );
}
