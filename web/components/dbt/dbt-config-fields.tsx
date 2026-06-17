"use client";

import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { DbtHubPackage } from "@/lib/elt/dbt-hub-packages";
import { DbtPackagePicker } from "@/components/dbt/dbt-package-picker";

export type DbtConfigValues = {
  packagePath: string;
  datasetName: string;
  repositoryBranch: string;
  runScope: "all" | "selection";
  selector: string;
  sliceValueVar: string;
  sliceColumnVar: string;
};

type Props = {
  values: DbtConfigValues;
  onChange: (patch: Partial<DbtConfigValues>) => void;
  sourceSlug?: string;
  pipelineTool?: string;
  pipelineId?: string | null;
  fieldClass?: string;
  compact?: boolean;
};

const defaultFieldClass =
  "mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white";

export function DbtConfigFields({
  values,
  onChange,
  sourceSlug,
  pipelineTool,
  pipelineId,
  fieldClass = defaultFieldClass,
  compact = false,
}: Props) {
  const [scaffolding, setScaffolding] = useState(false);
  const [scaffoldMsg, setScaffoldMsg] = useState<string | null>(null);

  async function scaffoldToGit() {
    if (!pipelineId) {
      setScaffoldMsg("Save the pipeline first, then scaffold dbt to Git.");
      return;
    }
    setScaffolding(true);
    setScaffoldMsg(null);
    try {
      const res = await fetch("/api/elt/dbt/scaffold", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId, sourceSlug, pushToGit: true }),
      });
      const data = (await res.json()) as {
        ok?: boolean;
        packagePath?: string;
        error?: string;
        pushed?: string[];
      };
      if (!res.ok) throw new Error(data.error ?? "Scaffold failed");
      if (data.packagePath) onChange({ packagePath: data.packagePath });
      setScaffoldMsg(
        data.pushed?.length
          ? `Pushed ${data.pushed.length} file(s) to Git and linked package path.`
          : "Linked package path on pipeline (Git push had no files)."
      );
    } catch (e) {
      setScaffoldMsg(e instanceof Error ? e.message : "Scaffold failed");
    } finally {
      setScaffolding(false);
    }
  }

  function applyHubPackage(pkg: DbtHubPackage, suggestedPath: string) {
    onChange({
      packagePath: suggestedPath,
      datasetName: values.datasetName || `${pkg.sourceKey}_dbt`,
    });
  }

  const intro = compact ? "text-[11px]" : "text-xs";

  return (
    <div className="space-y-3 rounded-lg border border-amber-200/80 bg-amber-50/50 px-3 py-3 dark:border-amber-800/50 dark:bg-amber-950/20">
      <p className={`${intro} leading-snug text-amber-950 dark:text-amber-100`}>
        Post-load dbt via{" "}
        <a
          href="https://dlthub.com/docs/dlt-ecosystem/transformations/dbt"
          className="font-medium underline"
          target="_blank"
          rel="noreferrer"
        >
          dlt&apos;s dbt runner
        </a>
        . Slice vars default to <code className="font-mono text-[10px]">elt_partition_value</code> /{" "}
        <code className="font-mono text-[10px]">elt_partition_column</code>.
      </p>

      {pipelineTool === "sling" ? (
        <p className={`${intro} text-amber-900 dark:text-amber-200`}>
          dbt hooks apply to <strong>dlt</strong> pipelines. For Sling replication, run dbt separately or switch tool to
          dlt for API sources.
        </p>
      ) : null}

      <DbtPackagePicker sourceSlug={sourceSlug} onSelect={applyHubPackage} />

      {pipelineId ? (
        <button
          type="button"
          disabled={scaffolding || !sourceSlug}
          onClick={() => void scaffoldToGit()}
          className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-200"
        >
          {scaffolding ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
          Scaffold dbt project to Git
        </button>
      ) : null}
      {scaffoldMsg ? <p className={`${intro} text-slate-600 dark:text-slate-400`}>{scaffoldMsg}</p> : null}

      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        dbt project path or git URL
        <input
          type="text"
          className={`${fieldClass} ${compact ? "font-mono text-xs" : "font-mono text-sm"}`}
          value={values.packagePath}
          onChange={(e) => onChange({ packagePath: e.target.value })}
          placeholder="e.g. ./eltpulse/dbt/my_pipeline or https://github.com/org/dbt-analytics"
          autoComplete="off"
        />
      </label>
      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        Output dataset / schema (optional)
        <input
          type="text"
          className={fieldClass}
          value={values.datasetName}
          onChange={(e) => onChange({ datasetName: e.target.value })}
          placeholder="Defaults to pipeline_name_dbt"
          autoComplete="off"
        />
      </label>
      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        Git branch / tag / commit (optional)
        <input
          type="text"
          className={fieldClass}
          value={values.repositoryBranch}
          onChange={(e) => onChange({ repositoryBranch: e.target.value })}
          placeholder="main"
          autoComplete="off"
        />
      </label>
      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        dbt run scope
        <select
          className={fieldClass}
          value={values.runScope}
          onChange={(e) => onChange({ runScope: e.target.value === "selection" ? "selection" : "all" })}
        >
          <option value="all">Full package (run_all)</option>
          <option value="selection">Selection only (--select)</option>
        </select>
      </label>
      {values.runScope === "selection" ? (
        <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
          dbt selector
          <input
            type="text"
            className={fieldClass}
            value={values.selector}
            onChange={(e) => onChange({ selector: e.target.value })}
            placeholder="e.g. tag:nightly or stg_stripe__+"
            autoComplete="off"
          />
        </label>
      ) : null}
      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        dbt var for slice value (optional)
        <input
          type="text"
          className={fieldClass}
          value={values.sliceValueVar}
          onChange={(e) => onChange({ sliceValueVar: e.target.value })}
          placeholder="elt_partition_value"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
      <label className={`block font-medium text-amber-900 dark:text-amber-100 ${compact ? "text-xs" : "text-sm"}`}>
        dbt var for partition column (optional)
        <input
          type="text"
          className={fieldClass}
          value={values.sliceColumnVar}
          onChange={(e) => onChange({ sliceColumnVar: e.target.value })}
          placeholder="elt_partition_column"
          autoComplete="off"
          spellCheck={false}
        />
      </label>
    </div>
  );
}
