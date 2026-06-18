"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ArrowLeft, Loader2 } from "lucide-react";
import { DbtConfigFields, type DbtConfigValues } from "@/components/dbt/dbt-config-fields";
import { SavedDestinationSelect } from "@/components/elt/saved-destination-select";

type PipelineOption = { id: string; name: string };

export function CatalogDbtNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSlug = searchParams.get("source") ?? undefined;
  const linkPipelineId = searchParams.get("pipeline") ?? undefined;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [destinationConnectionId, setDestinationConnectionId] = useState<string | null>(null);
  const [dbt, setDbt] = useState<DbtConfigValues>({
    packagePath: "",
    datasetName: "",
    repositoryBranch: "main",
    runScope: "all",
    selector: "",
    sliceValueVar: "",
    sliceColumnVar: "",
  });
  const [pipelines, setPipelines] = useState<PipelineOption[]>([]);
  const [linkToPipelineId, setLinkToPipelineId] = useState(linkPipelineId ?? "");
  const [scaffoldFromHub, setScaffoldFromHub] = useState(Boolean(sourceSlug));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/elt/pipelines", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { pipelines?: PipelineOption[] }) => setPipelines(data.pipelines ?? []))
      .catch(() => {});
  }, []);

  function patchDbt(patch: Partial<DbtConfigValues>) {
    setDbt((prev) => ({ ...prev, ...patch }));
  }

  function parseGitFromPath(path: string): { gitUrl: string | null; packagePath: string } {
    const trimmed = path.trim();
    if (/^https?:\/\//i.test(trimmed)) {
      return { gitUrl: trimmed, packagePath: trimmed };
    }
    return { gitUrl: null, packagePath: trimmed };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }
    setSaving(true);
    setError(null);
    const { gitUrl, packagePath } = parseGitFromPath(dbt.packagePath);
    try {
      const res = await fetch("/api/elt/dbt/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: name.trim(),
          description: description.trim() || null,
          packagePath,
          gitUrl,
          gitBranch: dbt.repositoryBranch.trim() || "main",
          targetSchema: dbt.datasetName.trim() || null,
          sourceSlug: sourceSlug ?? null,
          runScope: dbt.runScope,
          selector: dbt.runScope === "selection" ? dbt.selector.trim() || null : null,
          destinationConnectionId,
          pipelineId: linkToPipelineId || null,
          scaffoldFromHub: scaffoldFromHub && Boolean(sourceSlug),
        }),
      });
      const data = (await res.json()) as { error?: string; project?: { id: string } };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Create failed");
      if (data.project?.id) {
        router.push(`/catalog/dbt/${data.project.id}`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Create failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="mx-auto w-full min-w-0 max-w-3xl space-y-6">
      <div>
        <Link href="/catalog/dbt" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← dbt projects
        </Link>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">New dbt project</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
          Register a Git-backed or local dbt project as a first-class workspace entity — like dbt Cloud or Snowflake dbt
          Projects. Link it to a pipeline later for EL+T orchestration, or run transforms standalone against a warehouse
          connection.
        </p>
      </div>

      <form onSubmit={(e) => void onSubmit(e)} className="space-y-6">
        {error ? (
          <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800 dark:border-red-900 dark:bg-red-950/40 dark:text-red-200">
            {error}
          </p>
        ) : null}

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Identity</h2>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Project name
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="analytics_stripe"
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
          <label className="mt-4 block text-sm font-medium text-slate-700 dark:text-slate-200">
            Description (optional)
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={2}
              className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
            />
          </label>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">dbt configuration</h2>
          {sourceSlug ? (
            <label className="mt-3 flex items-center gap-2 text-sm text-slate-700 dark:text-slate-300">
              <input
                type="checkbox"
                checked={scaffoldFromHub}
                onChange={(e) => setScaffoldFromHub(e.target.checked)}
              />
              Scaffold from Transform hub package ({sourceSlug})
            </label>
          ) : null}
          <div className="mt-4">
            <DbtConfigFields values={dbt} onChange={patchDbt} sourceSlug={sourceSlug} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Warehouse (standalone runs)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Required when running dbt without a linked pipeline. Linked pipelines inherit their destination.
          </p>
          <div className="mt-3">
            <SavedDestinationSelect value={destinationConnectionId} onChange={setDestinationConnectionId} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline link (optional)</h2>
          <p className="mt-1 text-xs text-slate-500">
            Wire this project into an EL pipeline for post-load transforms in the same run.
          </p>
          <select
            value={linkToPipelineId}
            onChange={(e) => setLinkToPipelineId(e.target.value)}
            className="mt-3 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
          >
            <option value="">No pipeline (standalone)</option>
            {pipelines.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </select>
        </section>

        <div className="flex gap-3">
          <button
            type="submit"
            disabled={saving}
            className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50"
          >
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Create project
          </button>
          <Link
            href="/catalog/dbt"
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-semibold text-slate-700 dark:border-slate-600 dark:text-slate-200"
          >
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
