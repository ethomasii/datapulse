"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ExternalLink, GitBranch, Loader2, Unlink } from "lucide-react";
import type { DbtProjectSummary } from "@/lib/elt/dbt-projects";

type Props = {
  value: string | null;
  onChange: (projectId: string | null, project?: DbtProjectSummary | null) => void;
  pipelineId?: string | null;
  sourceSlug?: string;
  disabled?: boolean;
};

export function applyDbtProjectToForm(project: DbtProjectSummary): {
  packagePath: string;
  datasetName: string;
  repositoryBranch: string;
  runScope: "all" | "selection";
  selector: string;
} {
  return {
    packagePath: project.gitUrl ?? project.packagePath,
    datasetName: project.targetSchema ?? "",
    repositoryBranch: project.gitBranch ?? "main",
    runScope: project.runScope === "selection" ? "selection" : "all",
    selector: project.selector ?? "",
  };
}

export function DbtProjectPicker({ value, onChange, pipelineId, sourceSlug, disabled }: Props) {
  const [projects, setProjects] = useState<DbtProjectSummary[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void fetch("/api/elt/dbt/projects", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { projects?: DbtProjectSummary[] }) => setProjects(data.projects ?? []))
      .catch(() => setProjects([]))
      .finally(() => setLoading(false));
  }, []);

  const selected = projects.find((p) => p.id === value) ?? null;

  return (
    <div className="rounded-lg border border-violet-200/80 bg-violet-50/40 px-3 py-3 dark:border-violet-900/50 dark:bg-violet-950/20">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-sm font-semibold text-violet-900 dark:text-violet-100">Workspace dbt project</p>
          <p className="mt-0.5 text-xs text-violet-800/90 dark:text-violet-200/90">
            Link a registered project for shared config across pipelines, or configure inline below.
          </p>
        </div>
        <Link
          href={
            pipelineId
              ? `/catalog/dbt/new?pipeline=${encodeURIComponent(pipelineId)}${sourceSlug ? `&source=${encodeURIComponent(sourceSlug)}` : ""}`
              : `/catalog/dbt/new${sourceSlug ? `?source=${encodeURIComponent(sourceSlug)}` : ""}`
          }
          className="inline-flex items-center gap-1 text-xs font-medium text-sky-600 hover:underline dark:text-sky-400"
        >
          New project <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {loading ? (
        <Loader2 className="mt-3 h-4 w-4 animate-spin text-slate-400" />
      ) : (
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <select
            value={value ?? ""}
            disabled={disabled}
            onChange={(e) => {
              const id = e.target.value || null;
              const project = id ? projects.find((p) => p.id === id) ?? null : null;
              onChange(id, project);
            }}
            className="min-w-[12rem] flex-1 rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white disabled:opacity-50"
          >
            <option value="">Inline config only (not linked)</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
                {p.linkedPipelineIds.length > 0 ? ` · ${p.linkedPipelineIds.length} pipeline(s)` : ""}
              </option>
            ))}
          </select>
          {value ? (
            <>
              <Link
                href={`/catalog/dbt/${value}`}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
              >
                <GitBranch className="h-3.5 w-3.5" /> Open
              </Link>
              <button
                type="button"
                disabled={disabled}
                onClick={() => onChange(null, null)}
                className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-xs font-medium text-slate-700 hover:border-red-300 dark:border-slate-700 dark:text-slate-200 disabled:opacity-50"
              >
                <Unlink className="h-3.5 w-3.5" /> Unlink
              </button>
            </>
          ) : null}
        </div>
      )}

      {selected ? (
        <p className="mt-2 text-xs text-violet-800 dark:text-violet-200">
          Linked to <strong>{selected.name}</strong>
          {selected.gitUrl ? " · Git-backed" : selected.packagePath ? ` · ${selected.packagePath}` : ""}
          . Saving this pipeline updates the project and syncs dbt config.
        </p>
      ) : projects.length === 0 && !loading ? (
        <p className="mt-2 text-xs text-slate-500">
          No workspace projects yet —{" "}
          <Link href="/catalog/dbt/new" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            create one
          </Link>{" "}
          or configure dbt inline below.
        </p>
      ) : null}
    </div>
  );
}
