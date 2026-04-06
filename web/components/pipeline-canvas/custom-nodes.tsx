"use client";

import { useCallback } from "react";
import { Handle, Position, useReactFlow, type NodeProps } from "@xyflow/react";
import { ArrowRightLeft, Database, Target } from "lucide-react";
import { DESTINATION_GROUPS, SOURCE_GROUPS } from "@/lib/elt/catalog";
import { cn } from "@/lib/utils";
import { useCanvasBindings } from "./canvas-bindings-context";
import { TRANSFORM_TOOLS } from "./transform-tools";

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
  const hint = String(data.hint ?? "");

  return (
    <div className="w-[200px] max-w-[200px] shrink-0 overflow-visible rounded-xl border-2 border-emerald-500/90 bg-white px-2 py-2 shadow-md dark:border-emerald-600 dark:bg-emerald-950/50">
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800 dark:text-emerald-200">
        <Database className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Source
      </div>
      {bindings ? (
        <label className="nodrag mb-1 block min-w-0 text-[9px] font-semibold uppercase tracking-wide text-emerald-900 dark:text-emerald-100">
          Source type
          <select
            className={cn(
              selectBase,
              "border-emerald-200 focus:ring-emerald-500 dark:border-emerald-800",
              bindings.bindingsBusy && "opacity-60"
            )}
            value={bindings.pipelineSourceType}
            disabled={bindings.bindingsBusy}
            onChange={(e) => void bindings.onPickSourceType(e.target.value)}
          >
            {Object.entries(SOURCE_GROUPS).map(([group, types]) => (
              <optgroup key={group} label={group}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : (
        <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Open a saved pipeline to pick a source (updates generated extract code).
        </p>
      )}
      <NodeHintField
        value={hint}
        onChange={(v) => patch({ hint: v })}
        accent="emerald"
        placeholder="Scope, owner, credentials / links…"
      />
      <Handle type="source" position={Position.Right} className={handleClass("emerald")} />
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
    <div className="min-w-[210px] max-w-[240px] shrink-0 rounded-xl border-2 border-amber-500/90 bg-white px-2 py-2 shadow-md dark:border-amber-600 dark:bg-amber-950/40">
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
        <p className="nodrag mb-1 text-[10px] leading-snug text-amber-900/85 dark:text-amber-100/85">
          There is no repo upload or dbt project link here yet — use{" "}
          <span className="font-medium text-amber-950 dark:text-amber-50">Notes</span> below for intent, or choose another
          approach until repositories are connected to this pipeline.
        </p>
      ) : null}
      <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
        Part of this pipeline’s runnable graph — wire dbt/SQL in your repo; use{" "}
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
      <Handle type="source" position={Position.Right} className={handleClass("amber")} />
    </div>
  );
}

/** Load — land raw / staging in warehouse, lake, or files; can feed downstream modeling. */
export function DestinationNode({ id, data }: NodeProps) {
  const patch = useNodeDataUpdater(id);
  const bindings = useCanvasBindings();
  const hint = String(data.hint ?? "");

  return (
    <div className="w-[200px] max-w-[200px] shrink-0 overflow-visible rounded-xl border-2 border-sky-500/90 bg-white px-2 py-2 shadow-md dark:border-sky-600 dark:bg-sky-950/40">
      <Handle type="target" position={Position.Left} className={handleClass("sky")} />
      <div className="mb-1 flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wide text-sky-900 dark:text-sky-100">
        <Target className="h-3.5 w-3.5 shrink-0" aria-hidden />
        Destination
      </div>
      {bindings ? (
        <label className="nodrag mb-1 block min-w-0 text-[9px] font-semibold uppercase tracking-wide text-sky-900 dark:text-sky-100">
          Destination type
          <select
            className={cn(
              selectBase,
              "border-sky-200 focus:ring-sky-500 dark:border-sky-800",
              bindings.bindingsBusy && "opacity-60"
            )}
            value={bindings.pipelineDestinationType}
            disabled={bindings.bindingsBusy}
            onChange={(e) => void bindings.onPickDestinationType(e.target.value)}
          >
            {Object.entries(DESTINATION_GROUPS).map(([group, types]) => (
              <optgroup key={group} label={group}>
                {types.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </optgroup>
            ))}
          </select>
        </label>
      ) : (
        <p className="nodrag mb-1 text-[10px] leading-snug text-slate-500 dark:text-slate-400">
          Open a saved pipeline to pick a destination (updates generated load target).
        </p>
      )}
      <NodeHintField
        value={hint}
        onChange={(v) => patch({ hint: v })}
        accent="sky"
        placeholder="Scope, owner, credentials / links…"
      />
      <Handle type="source" position={Position.Right} className={handleClass("sky")} />
    </div>
  );
}

export const pipelineNodeTypes = {
  sourceNode: SourceNode,
  transformNode: TransformNode,
  destNode: DestinationNode,
};
