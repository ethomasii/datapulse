"use client";

import { useEffect, useState } from "react";
import { TRANSFORM_TOOLS } from "./transform-tools";
import { DbtConfigFields } from "@/components/dbt/dbt-config-fields";

const fieldClass =
  "mt-1 w-full rounded-lg border border-amber-200 bg-white px-2 py-1.5 text-sm text-slate-900 focus:outline-none focus:ring-1 focus:ring-amber-500 dark:border-amber-800 dark:bg-slate-950 dark:text-white";

type Props = {
  nodeId: string;
  /** Snapshot when the node was selected; remount via `key={nodeId}` when switching nodes. */
  initialData: Record<string, unknown>;
  onPatch: (patch: Record<string, unknown>) => void;
  /** Codegen embeds post-load dbt only for dlt Python pipelines. */
  pipelineTool: "dlt" | "sling";
  pipelineId?: string;
  sourceSlug?: string;
};

export function CanvasTransformInspector({
  nodeId,
  initialData,
  onPatch,
  pipelineTool,
  pipelineId,
  sourceSlug,
}: Props) {
  const [label, setLabel] = useState(() => String(initialData.label ?? ""));
  const [hint, setHint] = useState(() => String(initialData.hint ?? ""));
  const [transformTool, setTransformTool] = useState(() => String(initialData.transformTool ?? ""));
  const [dbtPackagePath, setDbtPackagePath] = useState(() => String(initialData.dbtPackagePath ?? ""));
  const [dbtDatasetName, setDbtDatasetName] = useState(() => String(initialData.dbtDatasetName ?? ""));
  const [dbtRepositoryBranch, setDbtRepositoryBranch] = useState(() => String(initialData.dbtRepositoryBranch ?? ""));
  const [dbtRunScope, setDbtRunScope] = useState<"all" | "selection">(() =>
    String(initialData.dbtRunScope ?? "all") === "selection" ? "selection" : "all"
  );
  const [dbtSelector, setDbtSelector] = useState(() => String(initialData.dbtSelector ?? ""));
  const [dbtSliceValueVar, setDbtSliceValueVar] = useState(() => String(initialData.dbtSliceValueVar ?? ""));
  const [dbtSliceColumnVar, setDbtSliceColumnVar] = useState(() => String(initialData.dbtSliceColumnVar ?? ""));
  const [postTransformCode, setPostTransformCode] = useState(() => String(initialData.postTransformCode ?? ""));

  useEffect(() => {
    setLabel(String(initialData.label ?? ""));
    setHint(String(initialData.hint ?? ""));
    setTransformTool(String(initialData.transformTool ?? ""));
    setDbtPackagePath(String(initialData.dbtPackagePath ?? ""));
    setDbtDatasetName(String(initialData.dbtDatasetName ?? ""));
    setDbtRepositoryBranch(String(initialData.dbtRepositoryBranch ?? ""));
    setDbtRunScope(String(initialData.dbtRunScope ?? "all") === "selection" ? "selection" : "all");
    setDbtSelector(String(initialData.dbtSelector ?? ""));
    setPostTransformCode(String(initialData.postTransformCode ?? ""));
    setDbtSliceValueVar(String(initialData.dbtSliceValueVar ?? ""));
    setDbtSliceColumnVar(String(initialData.dbtSliceColumnVar ?? ""));
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

      {transformTool === "dbt" && pipelineTool === "sling" ? (
        <p className="rounded-lg border border-amber-200/80 bg-amber-50/80 px-3 py-2 text-xs leading-snug text-amber-950 dark:border-amber-800/60 dark:bg-amber-950/30 dark:text-amber-100">
          Post-load dbt is only available for API and file-based pipelines. For database pipelines, use{" "}
          <strong className="font-medium">Notes</strong> to document a separate dbt job, or run dbt in CI against the same warehouse.
        </p>
      ) : null}

      {transformTool === "dbt" && pipelineTool === "dlt" ? (
        <DbtConfigFields
          compact
          fieldClass={fieldClass}
          sourceSlug={sourceSlug}
          pipelineTool={pipelineTool}
          pipelineId={pipelineId}
          values={{
            packagePath: dbtPackagePath,
            datasetName: dbtDatasetName,
            repositoryBranch: dbtRepositoryBranch,
            runScope: dbtRunScope,
            selector: dbtSelector,
            sliceValueVar: dbtSliceValueVar,
            sliceColumnVar: dbtSliceColumnVar,
          }}
          onChange={(patch) => {
            if (patch.packagePath !== undefined) {
              setDbtPackagePath(patch.packagePath);
              onPatch({ dbtPackagePath: patch.packagePath });
            }
            if (patch.datasetName !== undefined) {
              setDbtDatasetName(patch.datasetName);
              onPatch({ dbtDatasetName: patch.datasetName });
            }
            if (patch.repositoryBranch !== undefined) {
              setDbtRepositoryBranch(patch.repositoryBranch);
              onPatch({ dbtRepositoryBranch: patch.repositoryBranch });
            }
            if (patch.runScope !== undefined) {
              setDbtRunScope(patch.runScope);
              onPatch({ dbtRunScope: patch.runScope });
            }
            if (patch.selector !== undefined) {
              setDbtSelector(patch.selector);
              onPatch({ dbtSelector: patch.selector });
            }
            if (patch.sliceValueVar !== undefined) {
              setDbtSliceValueVar(patch.sliceValueVar);
              onPatch({ dbtSliceValueVar: patch.sliceValueVar });
            }
            if (patch.sliceColumnVar !== undefined) {
              setDbtSliceColumnVar(patch.sliceColumnVar);
              onPatch({ dbtSliceColumnVar: patch.sliceColumnVar });
            }
          }}
        />
      ) : null}

      {(transformTool === "python" || transformTool === "sql") ? (
        <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
          {transformTool === "python" ? (
            <p className="text-[11px] leading-snug text-amber-950 dark:text-amber-100">
              Python script appended after <code className="rounded bg-amber-100/80 px-0.5 font-mono text-[10px] dark:bg-amber-900/50">pipeline.run()</code>.
              Has access to <code className="font-mono text-[10px]">pipeline</code>, <code className="font-mono text-[10px]">info</code>,
              and <code className="font-mono text-[10px]">partition_key</code>.
            </p>
          ) : (
            <p className="text-[11px] leading-snug text-amber-950 dark:text-amber-100">
              SQL statements executed against the destination after load. Separate multiple statements with{" "}
              <code className="rounded bg-amber-100/80 px-0.5 font-mono text-[10px] dark:bg-amber-900/50">;</code>.
              Use fully-qualified table names (schema.table) as needed.
            </p>
          )}
          <label className="block text-xs font-medium text-amber-900 dark:text-amber-100">
            {transformTool === "python" ? "Python script" : "SQL statements"}
            <textarea
              value={postTransformCode}
              onChange={(e) => {
                const v = e.target.value;
                setPostTransformCode(v);
                onPatch({ postTransformCode: v });
              }}
              rows={10}
              spellCheck={false}
              placeholder={
                transformTool === "python"
                  ? "# e.g.\nprint(f'Loaded {info.loads_ids} load(s)')\n# call any Python here"
                  : "-- e.g.\nCREATE OR REPLACE VIEW analytics.v_orders AS SELECT * FROM raw.orders;\nUPDATE analytics.summary SET updated_at = NOW();"
              }
              className={`${fieldClass} resize-y font-mono text-xs leading-relaxed`}
            />
          </label>
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
