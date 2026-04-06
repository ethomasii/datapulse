"use client";

import { useEffect, useState } from "react";
import { TRANSFORM_TOOLS } from "./transform-tools";

const fieldClass =
  "mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-800 dark:bg-slate-950 dark:text-white";

type Props = {
  nodeId: string;
  /** Snapshot when the node was selected; remount via `key={nodeId}` when switching nodes. */
  initialData: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
};

export function CanvasTransformInspector({ nodeId, initialData, onPatch }: Props) {
  const [label, setLabel] = useState(() => String(initialData.label ?? ""));
  const [hint, setHint] = useState(() => String(initialData.hint ?? ""));
  const [transformTool, setTransformTool] = useState(() => String(initialData.transformTool ?? ""));

  useEffect(() => {
    setLabel(String(initialData.label ?? ""));
    setHint(String(initialData.hint ?? ""));
    setTransformTool(String(initialData.transformTool ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount or nodeId change defines a new snapshot
  }, [nodeId]);

  return (
    <div className="space-y-4">
      <p className="text-xs text-slate-600 dark:text-slate-400">
        Transform step for this pipeline — use <strong className="font-medium text-slate-800 dark:text-slate-200">Save to pipeline</strong>{" "}
        on the toolbar to persist the graph.
      </p>
      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
        Approach
        <select
          className={fieldClass}
          value={transformTool}
          onChange={(e) => {
            const v = e.target.value;
            setTransformTool(v);
            onPatch({ transformTool: v });
          }}
        >
          {TRANSFORM_TOOLS.map((o) => (
            <option key={o.value || "unset"} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      </label>
      {transformTool === "dbt" ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          There is no repo upload or dbt project link in the product yet — use <strong className="font-medium">Notes</strong>{" "}
          for what you plan to run, or pick another approach until a repository can be attached to this pipeline.
        </p>
      ) : null}
      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
        Label on diagram
        <input
          type="text"
          value={label}
          onChange={(e) => {
            const v = e.target.value;
            setLabel(v);
            onPatch({ label: v });
          }}
          placeholder="dbt / models"
          maxLength={200}
          className={fieldClass}
        />
      </label>
      <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
        Notes
        <textarea
          value={hint}
          onChange={(e) => {
            const v = e.target.value;
            setHint(v);
            onPatch({ hint: v });
          }}
          placeholder="Models, layers, tests…"
          rows={3}
          maxLength={400}
          className={`${fieldClass} resize-y font-sans text-sm leading-snug`}
        />
      </label>
    </div>
  );
}
