"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  ExternalLink,
  GitBranch,
  GitPullRequest,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";

type GitSync = {
  connected: boolean;
  inSync: boolean | null;
  prodInSync?: boolean | null;
  workingBranch?: string | null;
  productionDefinitionSource?: "neon" | "git";
  developmentDefinitionSource?: "neon" | "git";
  personalDevBranch?: string | null;
  message: string | null;
  path: string | null;
  repo: {
    owner: string;
    name: string;
    productionBranch: string;
    developmentBranch: string;
  } | null;
};

type GitCommit = {
  sha: string;
  fullSha: string;
  message: string;
  author: string;
  at: string;
  htmlUrl: string;
};

type Revision = {
  id: string;
  message: string | null;
  gitCommitSha: string | null;
  createdAt: string;
};

type Props = {
  pipelineId: string;
  pipelineName?: string;
  canWrite: boolean;
  onRestored?: () => void;
};

function defaultPrTitle(pipelineName: string | undefined, devBranch: string) {
  return pipelineName
    ? `[eltpulse] Promote ${pipelineName} (${devBranch} → production)`
    : `[eltpulse] Promote pipeline (${devBranch} → production)`;
}

function defaultPrBody(
  pipelineName: string | undefined,
  devBranch: string,
  prodBranch: string,
  yamlPath: string | null
) {
  const path = yamlPath ?? "eltpulse/pipelines/<name>.yaml";
  const name = pipelineName ?? "pipeline";
  return [
    `Promote **${name}** to production.`,
    "",
    `- **From:** \`${devBranch}\``,
    `- **To:** \`${prodBranch}\``,
    `- **Path:** \`${path}\``,
    "",
    "Review the YAML diff, then merge. If production runs use Neon, sync after merge or rely on your GitHub Action.",
    "",
    "_Opened from eltPulse._",
  ].join("\n");
}

export function PipelineGitPanel({ pipelineId, pipelineName, canWrite, onRestored }: Props) {
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<GitSync | null>(null);
  const [gitHistory, setGitHistory] = useState<GitCommit[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffSha, setDiffSha] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<Array<{ type: string; text: string }>>([]);
  const [showPrForm, setShowPrForm] = useState(false);
  const [prTitle, setPrTitle] = useState("");
  const [prBody, setPrBody] = useState("");
  const [lastPrUrl, setLastPrUrl] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${pipelineId}/git`, { credentials: "same-origin" });
      const data = (await res.json()) as {
        sync?: GitSync;
        gitHistory?: GitCommit[];
        revisions?: Revision[];
        error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Failed to load Git status");
      setSync(data.sync ?? null);
      setGitHistory(data.gitHistory ?? []);
      setRevisions(data.revisions ?? []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load");
    } finally {
      setLoading(false);
    }
  }, [pipelineId]);

  useEffect(() => {
    void load();
  }, [load]);

  const repo = sync?.repo ?? null;
  const devBranch = sync?.workingBranch ?? repo?.developmentBranch ?? "develop";
  const prodBranch = repo?.productionBranch ?? "main";
  const canPromote = Boolean(repo && devBranch !== prodBranch && sync?.connected);

  useEffect(() => {
    if (!showPrForm) return;
    setPrTitle(defaultPrTitle(pipelineName, devBranch));
    setPrBody(defaultPrBody(pipelineName, devBranch, prodBranch, sync?.path ?? null));
  }, [showPrForm, pipelineName, devBranch, prodBranch, sync?.path]);

  async function runAction(body: Record<string, unknown>, key: string) {
    setBusy(key);
    setError(null);
    try {
      const res = await fetch(`/api/elt/pipelines/${pipelineId}/git`, {
        method: "POST",
        credentials: "same-origin",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = (await res.json()) as {
        error?: string;
        htmlUrl?: string;
        alreadyExists?: boolean;
      };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.htmlUrl) {
        setLastPrUrl(data.htmlUrl);
        window.open(data.htmlUrl, "_blank", "noopener,noreferrer");
      }
      await load();
      onRestored?.();
      return data;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
      return null;
    } finally {
      setBusy(null);
    }
  }

  async function submitPromotionPr(e: React.FormEvent) {
    e.preventDefault();
    const data = await runAction(
      {
        action: "create_promotion_pr",
        title: prTitle.trim(),
        body: prBody.trim(),
        pushFirst: true,
      },
      "create-pr"
    );
    if (data?.htmlUrl) {
      setShowPrForm(false);
    }
  }

  async function showDiff(fullSha: string) {
    setDiffSha(fullSha);
    setDiffLines([]);
    try {
      const res = await fetch(
        `/api/elt/pipelines/${pipelineId}/git?diffRef=${encodeURIComponent(fullSha)}`,
        { credentials: "same-origin" }
      );
      const data = (await res.json()) as { diff?: { diff: Array<{ type: string; text: string }> } };
      setDiffLines(data.diff?.diff ?? []);
    } catch {
      setDiffLines([]);
    }
  }

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-xs text-slate-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" /> Loading version history…
      </p>
    );
  }

  const gitMode =
    sync?.productionDefinitionSource === "git" || sync?.developmentDefinitionSource === "git";
  const devRepoUrl =
    repo != null
      ? `https://github.com/${repo.owner}/${repo.name}/blob/${encodeURIComponent(devBranch)}/${sync?.path ?? ""}`
      : null;
  const prodRepoUrl =
    repo != null
      ? `https://github.com/${repo.owner}/${repo.name}/blob/${encodeURIComponent(prodBranch)}/${sync?.path ?? ""}`
      : null;

  return (
    <section className="space-y-3 rounded-lg border border-slate-200 bg-slate-50/80 p-3 dark:border-slate-700 dark:bg-slate-900/50">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="flex items-center gap-1.5 text-xs font-semibold text-slate-900 dark:text-white">
            <GitBranch className="h-3.5 w-3.5" aria-hidden />
            Version control
          </h3>
          <p className="mt-0.5 text-[10px] leading-snug text-slate-500">
            {sync?.message ??
              `Save pushes to ${devBranch}. Promote opens a PR to ${prodBranch} — no need to leave eltPulse.`}
          </p>
          {gitMode ? (
            <p className="mt-1 text-[10px] text-violet-700 dark:text-violet-300">
              Runs: dev → {sync?.developmentDefinitionSource ?? "neon"}
              {sync?.personalDevBranch ? ` (${sync.personalDevBranch})` : ""} · prod →{" "}
              {sync?.productionDefinitionSource ?? "neon"}
            </p>
          ) : (
            <p className="mt-1 text-[10px] text-slate-500">
              Runs use Neon (canvas). Enable Git-as-source on Repositories for live Git definitions.
            </p>
          )}
        </div>
        {sync?.inSync === false ? (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Unsynced
          </span>
        ) : sync?.inSync === true ? (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            {sync.prodInSync === false ? `${devBranch} synced` : "In sync"}
          </span>
        ) : null}
      </div>

      {sync?.prodInSync === false ? (
        <p className="rounded border border-violet-200 bg-violet-50/80 px-2 py-1.5 text-[10px] text-violet-900 dark:border-violet-900/50 dark:bg-violet-950/30 dark:text-violet-100">
          Production ({prodBranch}) is behind {devBranch}. Use Promote to production to open a review PR.
        </p>
      ) : null}

      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}
      {lastPrUrl ? (
        <p className="text-[10px] text-emerald-700 dark:text-emerald-300">
          PR opened.{" "}
          <a href={lastPrUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
            View on GitHub
          </a>
        </p>
      ) : null}

      {canWrite ? (
        <>
          <div className="flex flex-wrap gap-1.5">
            {canPromote ? (
              <button
                type="button"
                disabled={!!busy}
                onClick={() => setShowPrForm((v) => !v)}
                className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
              >
                {busy === "create-pr" ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : (
                  <GitPullRequest className="h-3 w-3" />
                )}
                Promote to production
              </button>
            ) : null}
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void runAction({ action: "sync_from_production" }, "sync-prod")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
              title={`Load YAML from ${prodBranch} into the canvas (after merge)`}
            >
              {busy === "sync-prod" ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
              Sync from {prodBranch}
            </button>
            <button
              type="button"
              disabled={!!busy}
              onClick={() => void runAction({ action: "push", branch: "development" }, "push-dev")}
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
            >
              Push YAML to {devBranch}
            </button>
            {devRepoUrl ? (
              <a
                href={devRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" /> {devBranch}
              </a>
            ) : null}
            {prodRepoUrl ? (
              <a
                href={prodRepoUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
              >
                <ExternalLink className="h-3 w-3" /> {prodBranch}
              </a>
            ) : null}
          </div>

          {showPrForm && canPromote ? (
            <form
              onSubmit={(e) => void submitPromotionPr(e)}
              className="space-y-2 rounded-md border border-violet-200 bg-white p-2.5 dark:border-violet-900/50 dark:bg-slate-950"
            >
              <p className="text-[10px] font-medium text-violet-900 dark:text-violet-100">
                Open PR: <span className="font-mono">{devBranch}</span> →{" "}
                <span className="font-mono">{prodBranch}</span>
              </p>
              <p className="text-[10px] text-slate-500">
                Pushes latest YAML to your dev branch first, then creates the pull request on GitHub.
              </p>
              <label className="block text-[10px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">Title</span>
                <input
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  required
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 text-xs dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <label className="block text-[10px]">
                <span className="font-medium text-slate-700 dark:text-slate-300">Description</span>
                <textarea
                  value={prBody}
                  onChange={(e) => setPrBody(e.target.value)}
                  rows={6}
                  className="mt-0.5 w-full rounded border border-slate-300 bg-white px-2 py-1 font-mono text-[10px] leading-relaxed dark:border-slate-600 dark:bg-slate-900 dark:text-white"
                />
              </label>
              <div className="flex flex-wrap gap-1.5">
                <button
                  type="submit"
                  disabled={!!busy || !prTitle.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2.5 py-1 text-[10px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
                >
                  {busy === "create-pr" ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                  Create pull request
                </button>
                <button
                  type="button"
                  onClick={() => setShowPrForm(false)}
                  className="rounded-md border border-slate-300 px-2.5 py-1 text-[10px] text-slate-600 dark:border-slate-600 dark:text-slate-300"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : null}
        </>
      ) : null}

      {gitHistory.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Git commits</p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {gitHistory.map((c) => (
              <li
                key={c.sha}
                className="flex items-start justify-between gap-2 rounded border border-slate-200/80 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="min-w-0">
                  <span className="font-mono text-[10px] text-violet-600 dark:text-violet-300">{c.sha}</span>
                  <span className="ml-1.5 text-[10px] text-slate-700 dark:text-slate-300">{c.message}</span>
                </span>
                <button
                  type="button"
                  disabled={!!busy}
                  onClick={() => void showDiff(c.fullSha)}
                  className="shrink-0 text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                >
                  Diff
                </button>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diffSha ? (
        <div className="max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-[10px] dark:border-slate-700 dark:bg-slate-950">
          {diffLines.map((line, i) => (
            <div
              key={`${diffSha}-${i}`}
              className={clsx(
                line.type === "add" && "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100",
                line.type === "remove" && "bg-red-50 text-red-900 dark:bg-red-950/40 dark:text-red-100"
              )}
            >
              {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
              {line.text}
            </div>
          ))}
        </div>
      ) : null}

      {revisions.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <History className="h-3 w-3" aria-hidden />
            Local revisions
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {revisions.slice(0, 8).map((r) => (
              <li
                key={r.id}
                className="flex items-center justify-between gap-2 rounded border border-slate-200/80 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900"
              >
                <span className="truncate text-[10px] text-slate-700 dark:text-slate-300">
                  {r.message ?? "Revision"} · {new Date(r.createdAt).toLocaleString()}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    onClick={() => void runAction({ action: "restore_revision", revisionId: r.id }, r.id)}
                    className="shrink-0 text-[10px] text-sky-600 hover:underline dark:text-sky-400"
                  >
                    Restore
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
