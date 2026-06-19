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
  Plus,
} from "lucide-react";
import type { DbtProjectSummary } from "@/lib/elt/dbt-projects";
import { CatalogAccessBanner } from "@/components/catalog/catalog-access-banner";
import { useWorkspacePermissions } from "@/lib/hooks/use-workspace-permissions";

type LegacyDbtProject = {
  pipelineId: string;
  pipelineName: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  modelCount: number;
  packagePath?: string;
  transformScope?: string;
  freshnessLabel: string;
};

export function CatalogDbtProjectsClient() {
  const { permissions } = useWorkspacePermissions();
  const canWrite = permissions?.canWrite ?? false;
  const [projects, setProjects] = useState<DbtProjectSummary[]>([]);
  const [legacy, setLegacy] = useState<LegacyDbtProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState<string | null>(null);
  const [runError, setRunError] = useState<string | null>(null);

  async function triggerDbt(opts: { dbtProjectId?: string; pipelineId?: string }, action: "run" | "compile" | "test") {
    const key = opts.dbtProjectId ?? opts.pipelineId ?? "";
    setRunning(`${key}:${action}`);
    setRunError(null);
    try {
      const res = await fetch("/api/elt/dbt/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "same-origin",
        body: JSON.stringify({ ...opts, action }),
      });
      const data = (await res.json()) as { error?: unknown; run?: { id: string } };
      if (!res.ok) {
        setRunError(typeof data.error === "string" ? data.error : "Failed to start dbt run");
        return;
      }
      if (data.run?.id) {
        window.location.href = `/runs?highlight=${encodeURIComponent(data.run.id)}`;
      }
    } catch {
      setRunError("Failed to start dbt run");
    } finally {
      setRunning(null);
    }
  }

  useEffect(() => {
    void (async () => {
      try {
        const [projRes, overviewRes] = await Promise.all([
          fetch("/api/elt/dbt/projects", { credentials: "same-origin" }),
          fetch("/api/elt/catalog/overview", { credentials: "same-origin" }),
        ]);
        let registered: DbtProjectSummary[] = [];
        if (projRes.ok) {
          const data = (await projRes.json()) as { projects?: DbtProjectSummary[] };
          registered = data.projects ?? [];
          setProjects(registered);
        }
        if (overviewRes.ok) {
          const data = (await overviewRes.json()) as { dbtProjects?: LegacyDbtProject[] };
          const registeredIds = new Set(registered.flatMap((p) => p.linkedPipelineIds));
          setLegacy((data.dbtProjects ?? []).filter((p) => !registeredIds.has(p.pipelineId)));
        }
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const hasAny = projects.length > 0 || legacy.length > 0;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-8">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href="/catalog" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
            ← Catalog
          </Link>
          <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">dbt projects</h1>
          <p className="mt-2 max-w-3xl text-slate-600 dark:text-slate-300">
          Optional git-backed SQL projects — recommended for production. Use canvas recipes to prototype, then link dbt
          when models need version control, tests, and docs.
          </p>
        </div>
        {canWrite ? (
          <Link
            href="/catalog/dbt/new"
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
          >
            <Plus className="h-4 w-4" /> New project
          </Link>
        ) : null}
      </div>

      <CatalogAccessBanner />

      {runError ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {runError}
        </p>
      ) : null}

      {loading ? (
        <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
      ) : !hasAny ? (
        <div className="space-y-6">
          <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center dark:border-slate-700">
            <GitBranch className="mx-auto h-8 w-8 text-slate-400" />
            <p className="mt-3 font-medium text-slate-900 dark:text-white">No dbt projects yet</p>
            <p className="mx-auto mt-2 max-w-lg text-sm text-slate-500">
              Start with{" "}
              <Link href="/catalog/components#recipes" className="font-medium text-violet-600 underline dark:text-violet-400">
                pipeline recipes
              </Link>{" "}
              for warehouse SQL on any lake — then add a git project here when you need versioned models.
            </p>
            {canWrite ? (
              <Link
                href="/catalog/dbt/new"
                className="mt-4 inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" /> Create dbt project
              </Link>
            ) : (
              <p className="mt-4 text-sm text-slate-500">Ask a workspace member to create dbt projects.</p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <Link
              href="/catalog/transform-hub"
              className="rounded-xl border border-violet-200 bg-violet-50/60 p-5 transition hover:border-violet-300 dark:border-violet-900 dark:bg-violet-950/30"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-violet-700 dark:text-violet-300">
                Step 1
              </p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">Browse Transform hub</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Pick a staging package for your connector (Stripe, GitHub, Postgres, …).
              </p>
            </Link>
            <Link
              href="/catalog/dbt/new"
              className="rounded-xl border border-sky-200 bg-sky-50/60 p-5 transition hover:border-sky-300 dark:border-sky-900 dark:bg-sky-950/30"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">Step 2</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">Register your project</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Point at a Git repo or local path, set target schema, and choose a warehouse connection.
              </p>
            </Link>
            <Link
              href="/builder?dbt=1"
              className="rounded-xl border border-slate-200 bg-white p-5 transition hover:border-slate-300 dark:border-slate-800 dark:bg-slate-900"
            >
              <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Step 3 (optional)</p>
              <p className="mt-2 font-semibold text-slate-900 dark:text-white">Link to a pipeline</p>
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
                Wire the project into an EL pipeline for sync → load → dbt in one run.
              </p>
            </Link>
          </div>
        </div>
      ) : (
        <ul className="space-y-4">
          {projects.map((p) => (
            <li
              key={p.id}
              className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900"
            >
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <Link href={`/catalog/dbt/${p.id}`} className="font-semibold text-slate-900 hover:text-sky-600 dark:text-white dark:hover:text-sky-400">
                    {p.name}
                  </Link>
                  <p className="mt-1 text-sm text-slate-500">
                    {p.gitUrl ? "Git-backed" : "Local path"}
                    {p.packagePath ? ` · ${p.packagePath.replace(/^dlt-hub\//, "")}` : ""}
                    {p.targetSchema ? ` · schema ${p.targetSchema}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {p.linkedPipelines.length > 0
                      ? `Linked to ${p.linkedPipelines.length} pipeline${p.linkedPipelines.length === 1 ? "" : "s"}`
                      : "Standalone"}
                    {p.scheduleEnabled && p.cronSchedule ? ` · scheduled ${p.cronSchedule}` : ""}
                  </p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {canWrite ? (
                  <button
                    type="button"
                    disabled={running !== null}
                    onClick={() => void triggerDbt({ dbtProjectId: p.id }, "run")}
                    className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 hover:border-violet-300 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
                  >
                    {running === `${p.id}:run` ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <PlayCircle className="h-3.5 w-3.5" />
                    )}{" "}
                    Run dbt
                  </button>
                ) : null}
                <Link
                  href={`/catalog/dbt/${p.id}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:border-sky-300 dark:border-slate-700 dark:text-slate-200"
                >
                  <Layers className="h-3.5 w-3.5" /> Open project
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

          {legacy.length > 0 ? (
            <>
              <li className="pt-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                Legacy inline dbt (not yet registered as projects)
              </li>
              {legacy.map((p) => (
                <li
                  key={p.pipelineId}
                  className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-5 dark:border-slate-800 dark:bg-slate-900/50"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div>
                      <h2 className="font-semibold text-slate-900 dark:text-white">{p.pipelineName}</h2>
                      <p className="mt-1 text-sm text-slate-500">
                        {p.sourceType} → {p.destinationType} · {p.modelCount} model{p.modelCount === 1 ? "" : "s"}
                        {p.freshnessLabel ? ` · ${p.freshnessLabel}` : ""}
                      </p>
                    </div>
                  </div>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {canWrite ? (
                      <button
                        type="button"
                        disabled={!p.enabled || running !== null}
                        onClick={() => void triggerDbt({ pipelineId: p.pipelineId }, "run")}
                        className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-800 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
                      >
                        Run dbt
                      </button>
                    ) : null}
                    <Link
                      href={`/builder?pipeline=${p.pipelineId}&dbt=1`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      Edit in builder
                    </Link>
                    <Link
                      href={`/assets?pipeline=${p.pipelineId}`}
                      className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
                    >
                      <Activity className="h-3.5 w-3.5" /> Lineage
                    </Link>
                  </div>
                </li>
              ))}
            </>
          ) : null}
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
