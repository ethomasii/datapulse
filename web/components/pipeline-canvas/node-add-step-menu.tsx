"use client";

import { useCallback, useEffect, useRef, useState, type MouseEvent as ReactMouseEvent } from "react";
import { Handle, NodeToolbar, Position } from "@xyflow/react";
import { Bot, ChevronRight, Loader2, Plus, Sparkles, Wand2 } from "lucide-react";
import clsx from "clsx";
import type { ComponentListItem } from "@/components/elt/component-palette";
import { ComponentPalette } from "@/components/elt/component-palette";
import {
  NODE_ADD_AI_ACTIONS,
  NODE_ADD_STEP_SECTIONS,
  type NodeAddAiActionId,
} from "@/lib/elt/node-add-step-menu-config";
import type { CanvasNodeRef } from "@/components/pipeline-canvas/canvas-graph-actions-context";
import { useCanvasGraphActions } from "@/components/pipeline-canvas/canvas-graph-actions-context";
import { useCanvasComponentCatalog } from "./use-canvas-component-catalog";

type Props = {
  node: CanvasNodeRef;
  className?: string;
  /** Render as the right-edge React Flow handle (same spot/size as the blue dot). */
  asHandle?: boolean;
};

const handlePlusClass =
  "connectionindicator nodrag nopan !pointer-events-auto !flex !h-3 !w-3 !items-center !justify-center !rounded-full !border-2 !border-violet-500 !bg-white !text-violet-700 shadow-sm transition hover:!bg-violet-50 dark:!border-violet-400 dark:!bg-slate-900 dark:!text-violet-200 dark:hover:!bg-violet-950/60";

const menuShellClass =
  "nodrag nopan w-52 max-h-[min(24rem,calc(100dvh-6rem))] overflow-y-auto rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900";

function ComponentPaletteModal({
  nodeLabel,
  onClose,
  onSelect,
}: {
  nodeLabel: string;
  onClose: () => void;
  onSelect: (component: ComponentListItem) => void;
}) {
  return (
    <div
      className="fixed inset-0 z-[300] flex items-center justify-center bg-black/40 p-4"
      role="dialog"
      aria-modal="true"
      onClick={onClose}
    >
      <div
        className="flex h-[min(90dvh,720px)] w-full max-w-lg flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-xl dark:border-slate-700 dark:bg-slate-950"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="border-b border-slate-200 px-4 py-3 dark:border-slate-700">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">
            Add transform after {nodeLabel}
          </h2>
        </div>
        <ComponentPalette
          className="min-h-0 flex-1 border-0"
          transformDesigner
          nativeOnly
          onSelect={onSelect}
        />
      </div>
    </div>
  );
}

export function NodeAddStepMenu({ node, className, asHandle }: Props) {
  const actions = useCanvasGraphActions();
  const { catalogById, loading: loadingCatalog } = useCanvasComponentCatalog();
  const [open, setOpen] = useState(false);
  const [showPalette, setShowPalette] = useState(false);
  const handleRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      const target = e.target as Node;
      if (handleRef.current?.contains(target)) return;
      if (menuRef.current?.contains(target)) return;
      setOpen(false);
      setShowPalette(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const pickComponent = useCallback(
    (component: ComponentListItem, config?: Record<string, unknown>) => {
      actions?.addComponentAfterNode(node.nodeId, component, config);
      setOpen(false);
      setShowPalette(false);
    },
    [actions, node.nodeId]
  );

  const pickQuick = useCallback(
    (componentId: string) => {
      const item = catalogById.get(componentId);
      if (item) pickComponent(item);
    },
    [catalogById, pickComponent]
  );

  const pickAi = useCallback(
    (actionId: NodeAddAiActionId) => {
      setOpen(false);
      if (actionId === "transform_by_example") {
        actions?.openTransformByExample(node);
      } else {
        actions?.openExtendWithAssistant(node, `Add a step after "${node.label}" that `);
      }
    },
    [actions, node]
  );

  if (!actions?.isDesigner) return null;

  const toggleOpen = (e: ReactMouseEvent) => {
    e.stopPropagation();
    setOpen((v) => !v);
  };

  const menuPanel = (
    <div
      ref={menuRef}
      role="menu"
      className={menuShellClass}
      onClick={(e) => e.stopPropagation()}
    >
      <p className="px-2 py-0.5 text-[9px] font-semibold uppercase tracking-wide text-slate-500">
        After {node.label}
      </p>

      {loadingCatalog ? (
        <div className="flex items-center gap-1.5 px-2 py-2 text-[10px] text-slate-500">
          <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
          Loading operators…
        </div>
      ) : (
        NODE_ADD_STEP_SECTIONS.map((section) => (
          <div key={section.id} className="border-t border-slate-100 px-0.5 py-0.5 dark:border-slate-800">
            <p className="px-1.5 py-0.5 text-[8px] font-bold uppercase tracking-wide text-violet-600 dark:text-violet-300">
              {section.label}
            </p>
            {section.items.map((item) => {
              const available = catalogById.has(item.componentId);
              return (
                <button
                  key={item.componentId}
                  type="button"
                  role="menuitem"
                  disabled={!available}
                  onClick={() => pickQuick(item.componentId)}
                  className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-violet-50 disabled:opacity-40 dark:hover:bg-violet-950/40"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block text-[11px] font-medium leading-tight text-slate-900 dark:text-white">
                      {item.label}
                    </span>
                    {item.hint ? (
                      <span className="block text-[9px] leading-tight text-slate-500">{item.hint}</span>
                    ) : null}
                  </span>
                  <ChevronRight className="h-3 w-3 shrink-0 text-slate-400" aria-hidden />
                </button>
              );
            })}
          </div>
        ))
      )}

      <div className="border-t border-slate-100 px-0.5 py-0.5 dark:border-slate-800">
        <button
          type="button"
          role="menuitem"
          onClick={() => setShowPalette(true)}
          className="flex w-full items-center gap-1.5 rounded px-1.5 py-1 text-left hover:bg-slate-50 dark:hover:bg-slate-800"
        >
          <Wand2 className="h-3 w-3 text-slate-500" aria-hidden />
          <span className="text-[11px] font-medium text-slate-900 dark:text-white">More transforms…</span>
        </button>
      </div>

      <div className="border-t border-slate-100 px-0.5 py-0.5 dark:border-slate-800">
        {NODE_ADD_AI_ACTIONS.map((action) => (
          <button
            key={action.id}
            type="button"
            role="menuitem"
            onClick={() => pickAi(action.id)}
            className="flex w-full items-start gap-1.5 rounded px-1.5 py-1 text-left hover:bg-teal-50 dark:hover:bg-teal-950/30"
          >
            {action.id === "transform_by_example" ? (
              <Sparkles className="mt-0.5 h-3 w-3 shrink-0 text-violet-600" aria-hidden />
            ) : (
              <Bot className="mt-0.5 h-3 w-3 shrink-0 text-teal-600" aria-hidden />
            )}
            <span className="min-w-0">
              <span className="block text-[11px] font-medium leading-tight text-slate-900 dark:text-white">
                {action.label}
              </span>
              <span className="block text-[9px] leading-tight text-slate-500">{action.hint}</span>
            </span>
          </button>
        ))}
      </div>
    </div>
  );

  if (asHandle) {
    return (
      <>
        <Handle
          ref={handleRef}
          type="source"
          position={Position.Right}
          className={clsx(handlePlusClass, open && "!ring-2 !ring-violet-300 dark:!ring-violet-700")}
          aria-label={`Add step after ${node.label}`}
          aria-expanded={open}
          title="Add next step"
          onClick={toggleOpen}
        >
          <Plus className="pointer-events-none h-2 w-2" strokeWidth={3} aria-hidden />
        </Handle>

        <NodeToolbar
          nodeId={node.nodeId}
          isVisible={open && !showPalette}
          position={Position.Right}
          align="center"
          offset={8}
        >
          {menuPanel}
        </NodeToolbar>

        {showPalette ? (
          <ComponentPaletteModal
            nodeLabel={node.label}
            onClose={() => {
              setShowPalette(false);
              setOpen(false);
            }}
            onSelect={(c) => pickComponent(c)}
          />
        ) : null}
      </>
    );
  }

  return (
    <>
      <div ref={handleRef} className={clsx("relative", className)}>
        <button
          type="button"
          onClick={toggleOpen}
          className={clsx(
            "nodrag nopan flex h-6 w-6 items-center justify-center rounded-full border-2 border-violet-500 bg-white text-violet-700 shadow-md transition hover:scale-105 hover:bg-violet-50 dark:border-violet-400 dark:bg-slate-900 dark:text-violet-200 dark:hover:bg-violet-950/60",
            open && "ring-2 ring-violet-300 dark:ring-violet-700"
          )}
          aria-label={`Add step after ${node.label}`}
          aria-expanded={open}
          title="Add next step"
        >
          <Plus className="h-3.5 w-3.5" strokeWidth={2.5} aria-hidden />
        </button>

        {open && !showPalette ? menuPanel : null}
      </div>

      {showPalette ? (
        <ComponentPaletteModal
          nodeLabel={node.label}
          onClose={() => {
            setShowPalette(false);
            setOpen(false);
          }}
          onSelect={(c) => pickComponent(c)}
        />
      ) : null}
    </>
  );
}
