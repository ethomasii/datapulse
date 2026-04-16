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
  /** Codegen embeds post-load dbt only for dlt Python pipelines. */
  pipelineTool: "dlt" | "sling";
};

export function CanvasTransformInspector({ nodeId, initialData, onPatch, pipelineTool }: Props) {
  const [label, setLabel] = useState(() => String(initialData.label ?? ""));
  const [hint, setHint] = useState(() => String(initialData.hint ?? ""));
  const [transformTool, setTransformTool] = useState(() => String(initialData.transformTool ?? ""));
  const [dbtPackagePath, setDbtPackagePath] = useState(() => String(initialData.dbtPackagePath ?? ""));
  const [dbtDatasetName, setDbtDatasetName] = useState(() => String(initialData.dbtDatasetName ?? ""));
  const [dbtRepositoryBranch, setDbtRepositoryBranch] = useState(() => String(initialData.dbtRepositoryBranch ?? ""));
  const [dbtRunScope, setDbtRunScope] = useState(() =>
    String(initialData.dbtRunScope ?? "all") === "selection" ? "selection" : "all"
  );
  const [dbtSelector, setDbtSelector] = useState(() => String(initialData.dbtSelector ?? ""));

  useEffect(() => {
    setLabel(String(initialData.label ?? ""));
    setHint(String(initialData.hint ?? ""));
    setTransformTool(String(initialData.transformTool ?? ""));
    setDbtPackagePath(String(initialData.dbtPackagePath ?? ""));
    setDbtDatasetName(String(initialData.dbtDatasetName ?? ""));
    setDbtRepositoryBranch(String(initialData.dbtRepositoryBranch ?? ""));
    setDbtRunScope(String(initialData.dbtRunScope ?? "all") === "selection" ? "selection" : "all");
    setDbtSelector(String(initialData.dbtSelector ?? ""));
    // eslint-disable-next-line react-hooks/exhaustive-deps -- remount or nodeId change defines a new snapshot
  }, [nodeId]);

  function patchDbt(partial: Record<string, unknown>) {
    onPatch(partial);
  }

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

      {transformTool === "dbt" && pipelineTool === "sling" ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          Post-load dbt is only available for API and file-based pipelines. For database pipelines, use{" "}
          <strong className="font-medium">Notes</strong> to document a separate dbt job, or run dbt in CI against the same warehouse.
        </p>
      ) : null}

      {transformTool === "dbt" && pipelineTool === "dlt" ? (
        <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
          <p className="text-[11px] leading-snug text-amber-950 dark:text-amber-100">
            Reference a <strong className="font-medium">dbt project</strong> (local path or git URL). After extract/load,
            a dbt run step is appended automatically. Slice runs pass{" "}
            <code className="rounded bg-amber-100/80 px-0.5 font-mono text-[10px] dark:bg-amber-900/50">
              {`var("elt_partition_value", none)`}
            </code>{" "}
            (same string as the pipeline <code className="font-mono text-[10px]">partition_key</code>) and, when Run
            slices has a date/key partition column saved,{" "}
            <code className="rounded bg-amber-100/80 px-0.5 font-mono text-[10px] dark:bg-amber-900/50">
              {`var("elt_partition_column", none)`}
            </code>{" "}
            for SQL filters.
          </p>
          <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
            dbt project path or git URL
            <input
              type="text"
              className={fieldClass}
              value={dbtPackagePath}
              onChange={(e) => {
                const v = e.target.value;
                setDbtPackagePath(v);
                patchDbt({ dbtPackagePath: v });
              }}
              placeholder="e.g. ./dbt_project or https://github.com/org/dbt-analytics"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
            Output dataset / schema (optional)
            <input
              type="text"
              className={fieldClass}
              value={dbtDatasetName}
              onChange={(e) => {
                const v = e.target.value;
                setDbtDatasetName(v);
                patchDbt({ dbtDatasetName: v });
              }}
              placeholder="Defaults to pipeline_name_dbt"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
            Git branch / tag / commit (optional)
            <input
              type="text"
              className={fieldClass}
              value={dbtRepositoryBranch}
              onChange={(e) => {
                const v = e.target.value;
                setDbtRepositoryBranch(v);
                patchDbt({ dbtRepositoryBranch: v });
              }}
              placeholder="main"
              autoComplete="off"
            />
          </label>
          <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
            dbt run scope
            <select
              className={fieldClass}
              value={dbtRunScope}
              onChange={(e) => {
                const v = e.target.value === "selection" ? "selection" : "all";
                setDbtRunScope(v);
                patchDbt({ dbtRunScope: v });
              }}
            >
              <option value="all">Full package (run_all — seed, sources tests, run)</option>
              <option value="selection">Selection only (extra --select on the run step)</option>
            </select>
          </label>
          {dbtRunScope === "selection" ? (
            <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
              dbt selector
              <input
                type="text"
                className={fieldClass}
                value={dbtSelector}
                onChange={(e) => {
                  const v = e.target.value;
                  setDbtSelector(v);
                  patchDbt({ dbtSelector: v });
                }}
                placeholder="e.g. my_mart+ or tag:nightly"
                autoComplete="off"
              />
            </label>
          ) : null}
        </div>
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
