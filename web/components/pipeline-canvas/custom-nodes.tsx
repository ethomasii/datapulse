"use client";

import { useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { ArrowRightLeft, Database, Target } from "lucide-react";
import { ComponentIcon } from "@/components/elt/component-icon";
import { DESTINATION_OPTIONS, SOURCE_OPTIONS } from "@/lib/elt/catalog";
import { ConnectorCombobox } from "@/components/elt/connector-combobox";
import { cn } from "@/lib/utils";
import { displayConnectorNodeHint } from "@/lib/elt/canvas-node-hints";
import { useCanvasBindings } from "./canvas-bindings-context";
import { TRANSFORM_TOOLS, transformToolBadge } from "./transform-tools";
import { NodeRightPort } from "./node-right-port";
import type { CanvasNodeRef } from "./canvas-graph-actions-context";
import { canAddStepAfterNode } from "@/lib/elt/canvas-node-append-after";
import { isRouterComponentId } from "@/lib/elt/router-routes";
import { RouterOutputPorts } from "./router-node-ports";

function nodeRef(id: string, type: string, data: Record<string, unknown>): CanvasNodeRef {
  return {
    nodeId: id,
    nodeType: type,
    label: String(data.label ?? data.componentId ?? type),
    componentId: data.componentId ? String(data.componentId) : undefined,
    config: (data.config as Record<string, unknown>) ?? undefined,
  };
}

function handleClass(kind: "emerald" | "amber" | "sky") {
  const map = {
    emerald: "!border-emerald-500 !bg-emerald-500",
    amber: "!border-amber-500 !bg-amber-500",
    sky: "!border-sky-500 !bg-sky-500",
  };
  return `!h-3 !w-3 !border-2 ${map[kind]}`;
}

function useNodeDataUpdater(id: string) {
  const { setNodes } = useReactFlow();
  return useCallback(
    (patch: Record<string, unknown>) => {
      setNodes((nds) =>
        nds.map((node) => (node.id === id ? { ...node, data: { ...node.data, ...patch } } : node))
      );
    },
    [id, setNodes]
  );
}

type FieldAccent = "emerald" | "amber" | "sky";

const accentRing: Record<FieldAccent, string> = {
  emerald:
    "hover:border-emerald-200 focus:border-emerald-500 focus:ring-emerald-500 dark:hover:border-emerald-800",
  amber: "hover:border-amber-200 focus:border-amber-500 focus:ring-amber-500 dark:hover:border-amber-800",
  sky: "hover:border-sky-200 focus:border-sky-500 focus:ring-sky-500 dark:hover:border-sky-800",
};

function NodeTitleField({
  value,
  onChange,
  accent,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: FieldAccent;
  placeholder: string;
}) {
  return (
    <input
      type="text"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      maxLength={200}
      className={cn(
        "nodrag nopan w-full min-w-0 rounded border border-transparent bg-white/80 px-1 py-0.5 text-sm font-semibold leading-snug text-slate-900 shadow-none focus:outline-none focus:ring-1 dark:bg-slate-950/50 dark:text-white",
        accentRing[accent]
      )}
      aria-label="Node title"
    />
  );
}

function NodeHintField({
  value,
  onChange,
  accent,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  accent: FieldAccent;
  placeholder: string;
}) {
  return (
    <textarea
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      rows={2}
      maxLength={400}
      className={cn(
        "nodrag nopan mt-1 w-full min-w-0 resize-y rounded border border-transparent bg-white/60 px-1 py-0.5 text-[10px] leading-tight text-slate-700 shadow-none focus:outline-none focus:ring-1 dark:bg-slate-950/40 dark:text-slate-300",
        accentRing[accent]
      )}
      aria-label="Node note"
    />
  );
}

const selectBase =
  "nodrag nopan mt-0.5 w-full min-w-0 max-w-full rounded border bg-white py-0.5 pl-1 pr-0 text-[10px] leading-tight text-slate-900 focus:outline-none focus:ring-1 dark:bg-slate-950 dark:text-white";

/** Extract → Load — connectors, APIs, DB reads. */
export function SourceNode({ id, data }: NodeProps) {
  const patch = useNodeDataUpdater(id);
  const bindings = useCanvasBindings();
  const storedHint = String(data.hint ?? "");
  const hint = bindings
    ? displayConnectorNodeHint("source", storedHint, bindings.pipelineSourceType)
    : storedHint;

  return (
    <div className="relative w-[200px] max-w-[200px] shrink-0 overflow-visible rounded-xl border-2 border-emerald-500/90 bg-white px-2 py-2 shadow-md dark:border-emerald-600 dark:bg-emerald-950/50">
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Source
      </div>
      {bindings ? (
        <div className="nodrag mb-1">
          <ConnectorCombobox
            options={SOURCE_OPTIONS}
            value={bindings.pipelineSourceType}
            onChange={(v) => void bindings.onPickSourceType(v)}
            disabled={bindings.bindingsBusy}
            compact
            className="border-emerald-200 dark:border-emerald-800"
          />
        </div>
      ) : (
        <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Open a saved pipeline to pick a source (updates generated extract code).
        </p>
      )}
      <NodeHintField
        value={hint}
        onChange={(v) => patch({ hint: v })}
        accent="emerald"
        placeholder="Notes — scope, owner, credentials…"
      />
      <NodeRightPort
        node={nodeRef(id, "sourceNode", data as Record<string, unknown>)}
        accent="emerald"
        allowAdd={canAddStepAfterNode({ id, type: "sourceNode", data, position: { x: 0, y: 0 } })}
      />
    </div>
  );
}

/** Transform — dbt / SQL / tests on tables already in the warehouse (after load). */
export function TransformNode({ id, data }: NodeProps) {
  const patch = useNodeDataUpdater(id);
  const label = String(data.label ?? "");
  const hint = String(data.hint ?? "");
  const transformTool = String(data.transformTool ?? "");

  return (
    <div className="relative min-w-[210px] max-w-[240px] shrink-0 overflow-visible rounded-xl border-2 border-amber-500/90 bg-white px-2 py-2 shadow-md dark:border-amber-600 dark:bg-amber-950/40">
      <Handle type="target" position={Position.Left} className={handleClass("amber")} />
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-amber-900 dark:text-amber-100">
        <ArrowRightLeft className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Transform
      </div>
      <label className="nodrag mb-1 block text-[10px] font-medium text-amber-900 dark:text-amber-100">
        Approach
        <select
          className={cn(selectBase, "border-amber-200 focus:ring-amber-500 dark:border-amber-800")}
          value={transformTool}
          onChange={(e) => patch({ transformTool: e.target.value })}
        >
          {TRANSFORM_TOOLS.map((o) => (
            <option key={o.value || "unset"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {transformTool === "dbt" ? (
        <p className="nodrag mb-1 truncate text-[10px] leading-snug text-amber-900/85 dark:text-amber-100/85">
          {String(data.dbtPackagePath ?? "").trim() ? (
            <>
              dbt project:{" "}
              <span className="font-mono text-[9px]">{String(data.dbtPackagePath).trim().slice(0, 42)}</span>
              {String(data.dbtPackagePath).trim().length > 42 ? "…" : ""}
              {String(data.dbtRunScope ?? "") === "selection" && String(data.dbtSelector ?? "").trim() ? (
                <span className="text-amber-800 dark:text-amber-200"> · select</span>
              ) : null}
            </>
          ) : (
            <>dbt project: link at /catalog/dbt →</>
          )}
        </p>
      ) : transformTool === "sql" ? (
        <p className="nodrag mb-1 text-[10px] leading-snug text-amber-900/85 dark:text-amber-100/85">
          Warehouse SQL — CTAS after load (not a dbt model)
        </p>
      ) : transformTool === "python" ? (
        <p className="nodrag mb-1 text-[10px] leading-snug text-amber-900/85 dark:text-amber-100/85">
          Dataframe (legacy) — Python on worker when SQL cannot express the transform
        </p>
      ) : transformTool ? (
        <p className="nodrag mb-1 text-[10px] leading-snug text-amber-900/85 dark:text-amber-100/85">
          {transformToolBadge(transformTool)}
        </p>
      ) : null}
      <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Part of this pipeline’s runnable graph — use{" "}
        <span className="font-medium text-slate-600 dark:text-slate-300">Save to pipeline</span> to persist.
      </p>
      <NodeTitleField
        value={label}
        onChange={(v) => patch({ label: v })}
        accent="amber"
        placeholder="Label on diagram"
      />
      <NodeHintField
        value={hint}
        onChange={(v) => patch({ hint: v })}
        accent="amber"
        placeholder="Models, layers, tests…"
      />
      <NodeRightPort
        node={nodeRef(id, "transformNode", data as Record<string, unknown>)}
        accent="amber"
        allowAdd={canAddStepAfterNode({ id, type: "transformNode", data, position: { x: 0, y: 0 } })}
      />
    </div>
  );
}

/** Load — land raw / staging in warehouse, lake, or files; can feed downstream modeling. */
export function DestinationNode({ id, data }: NodeProps) {
  const patch = useNodeDataUpdater(id);
  const bindings = useCanvasBindings();
  const storedHint = String(data.hint ?? "");
  const hint = bindings
    ? displayConnectorNodeHint("destination", storedHint, bindings.pipelineDestinationType)
    : storedHint;

  return (
    <div className="relative w-[200px] max-w-[200px] shrink-0 overflow-visible rounded-xl border-2 border-sky-500/90 bg-white px-2 py-2 shadow-md dark:border-sky-600 dark:bg-sky-950/40">
      <Handle type="target" position={Position.Left} className={handleClass("sky")} />
      <div className="mb-1.5 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100">
        <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Destination
      </div>
      {bindings ? (
        <div className="nodrag mb-1">
          <ConnectorCombobox
            options={DESTINATION_OPTIONS}
            value={bindings.pipelineDestinationType}
            onChange={(v) => void bindings.onPickDestinationType(v)}
            disabled={bindings.bindingsBusy}
            compact
            className="border-sky-200 dark:border-sky-800"
          />
        </div>
      ) : (
        <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Open a saved pipeline to pick a destination (updates generated load target).
        </p>
      )}
      <NodeHintField
        value={hint}
        onChange={(v) => patch({ hint: v })}
        accent="sky"
        placeholder="Notes — scope, owner, credentials…"
      />
      <NodeRightPort
        node={nodeRef(id, "destNode", data as Record<string, unknown>)}
        accent="sky"
        allowAdd={canAddStepAfterNode({ id, type: "destNode", data, position: { x: 0, y: 0 } })}
      />
    </div>
  );
}

export function ComponentNode({ id, data }: NodeProps) {
  const update = useNodeDataUpdater(id);
  const d = data as Record<string, unknown>;
  const title = String(d.label ?? d.componentId ?? "Component");
  const target = String(d.compileTarget ?? "");
  const badge = String(d.compileBadge ?? target);
  const category = String(d.category ?? "");
  const componentId = String(d.componentId ?? "");
  const manifestIcon = typeof d.icon === "string" ? d.icon : undefined;
  const ports = d.canvasPorts as { left?: boolean; right?: boolean } | undefined;
  const isRouter = isRouterComponentId(componentId);
  const isTerminal =
    category === "check" || target === "quality" || (ports?.left === true && ports?.right === false);
  const accent = isTerminal ? "amber" : "sky";
  const displayBadge = isTerminal ? "Validate" : badge;

  return (
    <div
      className={`relative w-[200px] max-w-[200px] shrink-0 overflow-visible rounded-lg border-2 px-3 py-2 shadow-sm ${
        isTerminal
          ? "border-dashed border-amber-400 bg-amber-50/40 dark:border-amber-500 dark:bg-amber-950/20"
          : "border-violet-400 bg-white dark:border-violet-600 dark:bg-slate-900"
      } ${isRouter ? "min-h-[5.5rem] pb-3" : ""}`}
    >
      {ports?.left !== false ? (
        <Handle type="target" position={Position.Left} className={handleClass(accent)} />
      ) : null}
      <div className="flex items-center gap-1.5">
        <ComponentIcon
          componentId={componentId}
          category={category}
          manifestIcon={manifestIcon}
          compileTarget={target}
          size="sm"
          className={isTerminal ? "text-amber-600 dark:text-amber-300" : "text-violet-600 dark:text-violet-300"}
        />
        <p
          className={`text-[10px] font-semibold uppercase tracking-wide ${
            isTerminal ? "text-amber-700 dark:text-amber-300" : "text-violet-600 dark:text-violet-300"
          }`}
        >
          {displayBadge}
        </p>
      </div>
      <NodeTitleField
        value={title}
        onChange={(v) => update({ label: v })}
        accent={accent}
        placeholder={isTerminal ? "Validation check" : "Component"}
      />
      {typeof d.compileHint === "string" && d.compileHint ? (
        <p className="mt-1 line-clamp-2 text-[10px] text-slate-500">{d.compileHint}</p>
      ) : null}
      {isTerminal ? (
        <p className="mt-1 text-[9px] font-medium uppercase tracking-wide text-amber-700/80 dark:text-amber-400/80">
          Assert only · no output
        </p>
      ) : null}
      {ports?.right !== false && !isTerminal ? (
        isRouter ? (
          <RouterOutputPorts
            data={d}
            nodeRef={nodeRef(id, "componentNode", d)}
            accent={accent}
            allowAdd={canAddStepAfterNode({ id, type: "componentNode", data: d, position: { x: 0, y: 0 } })}
          />
        ) : (
          <NodeRightPort
            node={nodeRef(id, "componentNode", d)}
            accent={accent}
            allowAdd={canAddStepAfterNode({ id, type: "componentNode", data: d, position: { x: 0, y: 0 } })}
          />
        )
      ) : null}
    </div>
  );
}

export const pipelineNodeTypes = {
  sourceNode: SourceNode,
  transformNode: TransformNode,
  destNode: DestinationNode,
  componentNode: ComponentNode,
};
