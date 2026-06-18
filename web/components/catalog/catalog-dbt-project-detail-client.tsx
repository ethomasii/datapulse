"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import {
  ArrowLeft,
  CalendarClock,
  GitBranch,
  Layers,
  Loader2,
  PlayCircle,
} from "lucide-react";
import { DbtConfigFields, type DbtConfigValues } from "@/components/dbt/dbt-config-fields";
import { SavedDestinationSelect } from "@/components/elt/saved-destination-select";
import type { DbtProjectSummary } from "@/lib/elt/dbt-projects";

type PipelineOption = { id: string; name: string };

export function CatalogDbtProjectDetailClient({ projectId }: { projectId: string }) {
  const [project, setProject] = useState<DbtProjectSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [running, setRunning] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [linkPipelineId, setLinkPipelineId] = useState("");
  const [scheduleEnabled, setScheduleEnabled] = useState(false);
  const [cronSchedule, setCronSchedule] = useState("");
  const [dbt, setDbt] = useState<DbtConfigValues>({
    packagePath: "",
    datasetName: "",
    repositoryBranch: "main",
    runScope: "all",
    selector: "",
    sliceValueVar: "",
    sliceColumnVar: "",
  });
  const [destinationConnectionId, setDestinationConnectionId] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/dbt/projects/${projectId}`, { credentials: "same-origin" });
      if (!res.ok) throw new Error("Project not found");
      const data = (await res.json()) as { project: DbtProjectSummary };
      const p = data.project;
      setProject(p);
      setDbt({
        packagePath: p.gitUrl ?? p.packagePath,
        datasetName: p.targetSchema ?? "",
        repositoryBranch: p.gitBranch ?? "main",
        runScope: p.runScope === "selection" ? "selection" : "all",
        selector: p.selector ?? "",
        sliceValueVar: "",
        sliceColumnVar: "",
      });
      setScheduleEnabled(p.scheduleEnabled);
      setCronSchedule(p.cronSchedule ?? "");
      setDestinationConnectionId(p.destinationConnectionId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void load();
    void fetch("/api/elt/pipelines", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { pipelines?: PipelineOption[] }) => setPipelines(data.pipelines ?? []))
      .catch(() => {});
  }, [load]);

  function parseGitFromPath(path: string): { gitUrl: string | null; packagePath: string } {
    const trimmed = path.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return { gitUrl: trimmed, packagePath: trimmed };
    }
    return { gitUrl: null, packagePath: trimmed };
  }

  async function save() {
    if (!project) return;
    setSaving(true);
    setError(null);
    setMessage(null);
    const { gitUrl, packagePath } = parseGitFromPath(dbt.packagePath);
    try {
      const res = await fetch(`/api/elt/dbt/projects/${projectId}`, {
        method: "PUT",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          packagePath,
          gitUrl,
          gitBranch: dbt.repositoryBranch.trim() || "main",
          targetSchema: dbt.datasetName.trim() || null,
          runScope: dbt.runScope,
          selector: dbt.runScope === "selection" ? dbt.selector.trim() || null : null,
          scheduleEnabled,
          cronSchedule: cronSchedule.trim() || null,
          destinationConnectionId,
        }),
      });
      const data = (await res.json()) as { error?: string; project?: DbtProjectSummary };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Save failed");
      if (data.project) setProject(data.project);
      setMessage("Saved");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  async function triggerDbt(action: "run" | "compile" | "test") {
    setRunning(action);
    setError(null);
    try {
      const res = await fetch("/api/elt/dbt/run", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ dbtProjectId: projectId, action }),
      });
      const data = (await res.json()) as { error?: string; run?: { id: string } };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Run failed");
      if (data.run?.id) window.location.href = `/runs?highlight=${encodeURIComponent(data.run.id)}`;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Run failed");
    } finally {
      setRunning(null);
    }
  }

  async function linkPipeline() {
    if (!linkPipelineId) return;
    setError(null);
    try {
      const res = await fetch(`/api/elt/dbt/projects/${projectId}/link`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pipelineId: linkPipelineId }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Link failed");
      setLinkPipelineId("");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Link failed");
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!project) {
    return (
      <div className="mx-auto max-w-3xl py-12 text-center">
        <p className="text-slate-600 dark:text-slate-300">{error ?? "Project not found"}</p>
        <Link href="/catalog/dbt" className="mt-4 inline-block text-sm text-sky-600 hover:underline">
          ← Back to projects
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <Link href="/catalog/dbt" className="inline-flex items-center gap-1 text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          <ArrowLeft className="h-4 w-4" /> dbt projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">{project.name}</h1>
        {project.description ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">{project.description}</p>
        ) : null}
      </div>

      {error ? (
        <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
          {error}
        </p>
      ) : null}
      {message ? (
        <p className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          {message}
        </p>
      ) : null}

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          disabled={running !== null}
          onClick={() => void triggerDbt("run")}
          className="inline-flex items-center gap-1 rounded-lg border border-violet-200 bg-violet-50 px-3 py-1.5 text-sm font-medium text-violet-800 disabled:opacity-50 dark:border-violet-900 dark:bg-violet-950/40 dark:text-violet-200"
        >
          {running === "run" ? <Loader2 className="h-4 w-4 animate-spin" /> : <PlayCircle className="h-4 w-4" />}
          Run dbt
        </button>
        <button
          type="button"
          disabled={running !== null}
          onClick={() => void triggerDbt("compile")}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          {running === "compile" ? <Loader2 className="h-4 w-4 animate-spin" /> : <GitBranch className="h-4 w-4" />}
          Compile
        </button>
        <Link
          href="/runs"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          <PlayCircle className="h-4 w-4" /> Runs
        </Link>
        <Link
          href="/schedule"
          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-700 dark:border-slate-700 dark:text-slate-200"
        >
          <CalendarClock className="h-4 w-4" /> Schedule
        </Link>
      </div>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Linked pipelines</h2>
        {project.linkedPipelines.length === 0 ? (
          <p className="mt-2 text-sm text-slate-500">No pipelines linked — standalone transform only.</p>
        ) : (
          <ul className="mt-3 space-y-2">
            {project.linkedPipelines.map((p) => (
              <li key={p.id} className="flex items-center justify-between gap-2 text-sm">
                <Link href={`/builder?pipeline=${p.id}&dbt=1`} className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                  <Layers className="mr-1 inline h-4 w-4" />
                  {p.name}
                </Link>
                <span className="text-xs text-slate-500">
                  {p.sourceType} → {p.destinationType}
                  {!p.enabled ? " · disabled" : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
        <div className="mt-4 flex flex-wrap gap-2">
          <select
            value={linkPipelineId}
            onChange={(e) => setLinkPipelineId(e.target.value)}
            className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="">Link to pipeline…</option>
            {pipelines
              .filter((p) => !project.linkedPipelineIds.includes(p.id))
              .map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
          </select>
          <button
            type="button"
            disabled={!linkPipelineId}
            onClick={() => void linkPipeline()}
            className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-1.5 text-sm font-medium text-sky-800 disabled:opacity-50 dark:border-sky-900 dark:bg-sky-950/40 dark:text-sky-200"
          >
            Link pipeline
          </button>
        </div>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900 space-y-4">
        <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Configuration</h2>
        <DbtConfigFields
          values={dbt}
          onChange={(patch) => setDbt((prev) => ({ ...prev, ...patch }))}
          sourceSlug={project.sourceSlug ?? undefined}
          dbtProjectId={projectId}
        />
        <div>
          <h3 className="text-xs font-semibold uppercase tracking-wide text-slate-500">Warehouse</h3>
          <SavedDestinationSelect value={destinationConnectionId} onChange={setDestinationConnectionId} />
        </div>
        <div className="rounded-lg border border-slate-200 p-3 dark:border-slate-700">
          <label className="flex items-center gap-2 text-sm font-medium text-slate-800 dark:text-slate-200">
            <input type="checkbox" checked={scheduleEnabled} onChange={(e) => setScheduleEnabled(e.target.checked)} />
            Scheduled dbt-only runs
          </label>
          {scheduleEnabled ? (
            <input
              type="text"
              value={cronSchedule}
              onChange={(e) => setCronSchedule(e.target.value)}
              placeholder="0 6 * * *"
              className="mt-2 w-full rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          ) : null}
        </div>
        <button
          type="button"
          disabled={saving}
          onClick={() => void save()}
          className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Save changes
        </button>
      </section>

      {project.hubPackageKey ? (
        <p className="text-xs text-slate-500">
          Hub package: <code className="font-mono">{project.hubPackageKey}</code>
          {project.sourceSlug ? ` · connector ${project.sourceSlug}` : ""}
        </p>
      ) : null}
    </div>
  );
}
