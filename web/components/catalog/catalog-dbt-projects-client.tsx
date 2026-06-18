"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import {
  Activity,
  ArrowRight,
  CalendarClock,
  FolderGit2,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
} from "lucide-react";

type DbtProject = {
  pipelineId: string;
  pipelineName: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  modelCount: number;
  packagePath?: string;
  transformScope?: string;
  freshnessLabel: string;
  lastRun?: { id: string; status: string; dbtManifest?: { models: { name: string; status: string }[] } };
  dbtDiff?: { missingFromRun: string[]; failedModels: string[] };
};

const V3_ROADMAP = [
  { id: "projects", label: "dbt Projects workspace (this page)", done: true },
  { id: "git", label: "Git-backed project browser + scaffold", done: true },
  { id: "manifest", label: "Manifest on runs + config diff", done: true },
  { id: "schedule", label: "Scheduled dbt via pipeline tasks", done: false },
  { id: "compile", label: "dbt compile/run from UI (native executor)", done: false },
  { id: "tracing", label: "OpenTelemetry-style run tracing", done: false },
] as const;

export function CatalogDbtProjectsClient() {
  const [projects, setProjects] = useState<DbtProject[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      try {
        const res = await fetch("/api/elt/catalog/overview");
        if (res.ok) {
          const data = (await res.json()) as { dbtProjects: DbtProject[] };
          setProjects(data.dbtProjects ?? []);
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div>
        <Link href="/catalog" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Catalog
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">dbt projects</h1>
        <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Workspace view of dbt transforms attached to pipelines — inspired by{" "}
          <a
            href="https://www.snowflake.com/en/developers/guides/dbt-projects-on-snowflake/"
            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
            target="_blank"
            rel="noopener noreferrer"
          >
            dbt Projects on Snowflake
          </a>
          . Each project maps to a pipeline with dbt enabled; runs, schedules, and Git scaffold link from here.
        </p>
      </div>

      <div className="rounded-xl border border-violet-200 bg-violet-50/60 p-4 dark:border-violet-900 dark:bg-violet-950/30">
        <h2 className="text-sm font-semibold text-violet-900 dark:text-violet-100">dbt v3 roadmap</h2>
        <ul className="mt-2 grid gap-1 sm:grid-cols-2">
          {V3_ROADMAP.map((item) => (
            <li key={item.id} className="flex items-center gap-2 text-xs text-slate-700 dark:text-slate-300">
              <span className={item.done ? "text-emerald-600" : "text-slate-400"}>{item.done ? "✓" : "○"}</span>
              {item.label}
            </li>
          ))}
        </ul>
      </div>

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : projects.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
          <GitBranch className="mx-auto h-8 w-8 text-slate-400" />
          <p className="mt-3 font-medium text-slate-900 dark:text-white">No dbt projects yet</p>
          <p className="mt-1 text-sm text-slate-500">Enable dbt on a pipeline in the builder or open the dbt hub.</p>
          <Link href="/builder?dbt=1" className="mt-4 inline-flex text-sm font-semibold text-sky-600 dark:text-sky-400">
            Open builder with dbt →
          </Link>
        </div>
      ) : (
        <ul className="space-y-4">
          {projects.map((p) => (
            <li
              key={p.pipelineId}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-slate-900 dark:text-white">{p.pipelineName}</h2>
                  <p className="mt-1 text-sm text-slate-500">
                    {p.sourceType} → {p.destinationType} · {p.modelCount} model{p.modelCount === 1 ? "" : "s"}
                    {p.packagePath ? ` · ${p.packagePath.replace(/^dlt-hub\//, "")}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.transformScope === "post_replication" ? "Post-replication dbt" : "In-pipeline dbt"} ·{" "}
                    {p.freshnessLabel}
                  </p>
                </div>
                {!p.enabled ? (
                  <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-medium text-slate-500">
                    Disabled
                  </span>
                ) : null}
              </div>

              {p.lastRun?.dbtManifest ? (
                <p className="mt-3 text-xs text-violet-700 dark:text-violet-300">
                  Last run:{" "}
                  {p.lastRun.dbtManifest.models.filter((m) => m.status === "success").length}/
                  {p.lastRun.dbtManifest.models.length} models succeeded
                </p>
              ) : null}
              {p.dbtDiff && (p.dbtDiff.missingFromRun.length > 0 || p.dbtDiff.failedModels.length > 0) ? (
                <p className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  {p.dbtDiff.missingFromRun.length > 0
                    ? `Missing on run: ${p.dbtDiff.missingFromRun.join(", ")}`
                    : ""}
                  {p.dbtDiff.failedModels.length > 0 ? ` · Failed: ${p.dbtDiff.failedModels.join(", ")}` : ""}
                </p>
              ) : null}

              <div className="mt-4 flex flex-wrap gap-2">
                <Link
                  href={`/builder?pipeline=${p.pipelineId}&dbt=1`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <Layers className="h-3.5 w-3.5" /> Edit project
                </Link>
                <Link
                  href={`/runs?pipeline=${p.pipelineId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <PlayCircle className="h-3.5 w-3.5" /> Runs
                </Link>
                <Link
                  href={`/assets?pipeline=${p.pipelineId}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <Activity className="h-3.5 w-3.5" /> Lineage
                </Link>
                <Link
                  href="/schedule"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <CalendarClock className="h-3.5 w-3.5" /> Schedule
                </Link>
                <Link
                  href="/repos"
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <FolderGit2 className="h-3.5 w-3.5" /> Git
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <Link
        href="/docs/dbt"
        className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
      >
        Technical dbt docs <ArrowRight className="h-4 w-4" />
      </Link>
    </div>
  );
}
