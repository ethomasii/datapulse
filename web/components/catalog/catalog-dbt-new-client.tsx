"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { ArrowLeft, ChevronDown, ChevronUp, Loader2 } from "lucide-react";
import { DbtConfigFields, type DbtConfigValues } from "@/components/dbt/dbt-config-fields";
import { SavedDestinationSelect } from "@/components/elt/saved-destination-select";
import { GithubRepoPicker } from "@/components/integrations/github-repo-picker";
import { defaultDbtRepoSubpath } from "@/lib/elt/eltpulse-repo-layout";
import { parseGithubRepositoryUrl } from "@/lib/integrations/parse-github-repo-url";

type PipelineOption = { id: string; name: string };
type GitSourceMode = "github" | "url" | "draft" | "scaffold";

export function CatalogDbtNewClient() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const sourceSlug = searchParams.get("source") ?? undefined;
  const linkPipelineId = searchParams.get("pipeline") ?? undefined;

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [gitMode, setGitMode] = useState<GitSourceMode>(sourceSlug ? "scaffold" : "github");
  const [githubRepo, setGithubRepo] = useState<{ owner: string; repo: string; branch: string } | null>(null);
  const [gitSubpath, setGitSubpath] = useState("");
  const [gitUrlInput, setGitUrlInput] = useState("");
  const [showAdvanced, setShowAdvanced] = useState(false);
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
  const [githubConnected, setGithubConnected] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSubpath = useMemo(() => {
    const trimmed = gitSubpath.trim();
    if (trimmed) return trimmed;
    if (name.trim()) return defaultDbtRepoSubpath(name.trim());
    return "eltpulse/dbt/my_project";
  }, [gitSubpath, name]);

  useEffect(() => {
    void fetch("/api/elt/pipelines", { credentials: "same-origin" })
      .then((r) => r.json())
      .then((data: { pipelines?: PipelineOption[] }) => setPipelines(data.pipelines ?? []))
      .catch(() => {});
    void fetch("/api/integrations/github/repos", { credentials: "same-origin" })
      .then((r) => {
        setGithubConnected(r.ok);
        if (!r.ok) setGitMode((m) => (m === "github" ? "url" : m));
      })
      .catch(() => {
        setGitMode((m) => (m === "github" ? "url" : m));
      });
  }, []);

  useEffect(() => {
    if (githubRepo) {
      patchDbt({ repositoryBranch: githubRepo.branch, packagePath: resolvedSubpath });
    }
  }, [githubRepo, resolvedSubpath]);

  function patchDbt(patch: Partial<DbtConfigValues>) {
    setDbt((prev) => ({ ...prev, ...patch }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError("Project name is required");
      return;
    }

    setSaving(true);
    setError(null);

    const payload: Record<string, unknown> = {
      name: name.trim(),
      description: description.trim() || null,
      targetSchema: dbt.datasetName.trim() || null,
      sourceSlug: sourceSlug ?? null,
      runScope: dbt.runScope,
      selector: dbt.runScope === "selection" ? dbt.selector.trim() || null : null,
      destinationConnectionId,
      pipelineId: linkToPipelineId || null,
    };

    if (gitMode === "draft") {
      payload.draft = true;
    } else if (gitMode === "scaffold") {
      payload.scaffoldFromHub = true;
      payload.scaffoldToDefaultRepo = true;
      payload.gitSubpath = resolvedSubpath;
      payload.packagePath = resolvedSubpath;
    } else if (gitMode === "github") {
      if (!githubRepo) {
        setError("Choose a GitHub repository or switch to another Git source option.");
        setSaving(false);
        return;
      }
      payload.gitOwner = githubRepo.owner;
      payload.gitRepo = githubRepo.repo;
      payload.gitBranch = githubRepo.branch;
      payload.gitSubpath = resolvedSubpath;
      payload.packagePath = resolvedSubpath;
    } else {
      const parsed = parseGithubRepositoryUrl(gitUrlInput.trim());
      if (!parsed) {
        setError("Enter a valid GitHub URL (https://github.com/org/repo).");
        setSaving(false);
        return;
      }
      payload.gitUrl = `https://github.com/${parsed.owner}/${parsed.repo}`;
      payload.gitBranch = parsed.branch ?? (dbt.repositoryBranch.trim() || "main");
      payload.gitSubpath = resolvedSubpath;
      payload.packagePath = resolvedSubpath;
    }

    try {
      const res = await fetch("/api/elt/dbt/projects", {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = (await res.json()) as { error?: string; project?: { id: string } };
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Create failed");

      if (data.project?.id && gitMode === "scaffold" && sourceSlug) {
        await fetch("/api/elt/dbt/scaffold", {
          method: "POST",
          credentials: "same-origin",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            dbtProjectId: data.project.id,
            sourceSlug,
            pushToGit: true,
          }),
        }).catch(() => {});
      }

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
          Only a <strong>project name</strong> is required. Connect GitHub to pick or create a repo — dbt projects live
          in Git, not on eltPulse servers. Configure warehouse, run scope, and pipeline links anytime after create.
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
            Project name <span className="text-red-500">*</span>
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
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Git source</h2>
          <p className="mt-1 text-xs text-slate-500">
            Pick a repository you own (same flow as{" "}
            <Link href="/repos" className="text-sky-600 hover:underline dark:text-sky-400">
              Repositories
            </Link>
            ), paste a URL, scaffold a starter into your default repo, or configure Git later.
          </p>

          <div className="mt-4 flex flex-wrap gap-2">
            {githubConnected ? (
              <button
                type="button"
                onClick={() => setGitMode("github")}
                className={
                  gitMode === "github"
                    ? "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                }
              >
                GitHub picker
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setGitMode("url")}
              className={
                gitMode === "url"
                  ? "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              }
            >
              Paste URL
            </button>
            {sourceSlug ? (
              <button
                type="button"
                onClick={() => setGitMode("scaffold")}
                className={
                  gitMode === "scaffold"
                    ? "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                    : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
                }
              >
                Scaffold in default repo
              </button>
            ) : null}
            <button
              type="button"
              onClick={() => setGitMode("draft")}
              className={
                gitMode === "draft"
                  ? "rounded-lg bg-sky-600 px-3 py-1.5 text-xs font-semibold text-white"
                  : "rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-medium text-slate-700 dark:border-slate-600 dark:text-slate-200"
              }
            >
              Configure Git later
            </button>
          </div>

          {!githubConnected && gitMode === "github" ? (
            <p className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
              Connect GitHub under{" "}
              <Link href="/integrations" className="font-medium underline">
                Integrations
              </Link>{" "}
              to browse repos, or use Paste URL / Configure Git later.
            </p>
          ) : null}

          {gitMode === "github" && githubConnected ? (
            <div className="mt-4 space-y-3">
              <GithubRepoPicker
                value={githubRepo}
                onChange={(r) => setGithubRepo({ owner: r.owner, repo: r.repo, branch: r.branch })}
              />
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Folder in repo
                <input
                  type="text"
                  value={gitSubpath}
                  onChange={(e) => setGitSubpath(e.target.value)}
                  placeholder={name.trim() ? defaultDbtRepoSubpath(name.trim()) : "eltpulse/dbt/my_project"}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>
          ) : null}

          {gitMode === "url" ? (
            <div className="mt-4 space-y-3">
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                GitHub repository URL
                <input
                  type="url"
                  value={gitUrlInput}
                  onChange={(e) => setGitUrlInput(e.target.value)}
                  placeholder="https://github.com/your-org/dbt-analytics"
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </label>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-200">
                Folder in repo
                <input
                  type="text"
                  value={gitSubpath}
                  onChange={(e) => setGitSubpath(e.target.value)}
                  placeholder={name.trim() ? defaultDbtRepoSubpath(name.trim()) : "eltpulse/dbt/my_project"}
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 font-mono text-sm dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                />
              </label>
            </div>
          ) : null}

          {gitMode === "scaffold" ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Creates the project and pushes a Transform hub starter for <code className="font-mono text-xs">{sourceSlug}</code>{" "}
              into your default GitHub repo at{" "}
              <code className="font-mono text-xs">{resolvedSubpath}</code>. Set the default repo on{" "}
              <Link href="/repos" className="text-sky-600 hover:underline dark:text-sky-400">
                Repositories
              </Link>
              .
            </p>
          ) : null}

          {gitMode === "draft" ? (
            <p className="mt-3 text-sm text-slate-600 dark:text-slate-300">
              Saves a workspace shell with the name only. Link GitHub on the project detail page before running dbt.
            </p>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white dark:border-slate-800 dark:bg-slate-900">
          <button
            type="button"
            onClick={() => setShowAdvanced((v) => !v)}
            className="flex w-full items-center justify-between px-5 py-4 text-left text-sm font-semibold text-slate-900 dark:text-white"
          >
            Advanced dbt settings (optional)
            {showAdvanced ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
          {showAdvanced ? (
            <div className="border-t border-slate-200 px-5 pb-5 pt-2 dark:border-slate-700">
              <DbtConfigFields values={dbt} onChange={patchDbt} sourceSlug={sourceSlug} compact gitOnly />
            </div>
          ) : null}
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Warehouse (optional)</h2>
          <p className="mt-1 text-xs text-slate-500">Needed for standalone dbt runs without a linked pipeline.</p>
          <div className="mt-3">
            <SavedDestinationSelect value={destinationConnectionId} onChange={setDestinationConnectionId} />
          </div>
        </section>

        <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Pipeline link (optional)</h2>
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
