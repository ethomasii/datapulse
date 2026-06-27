"use client";

import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import {
  ArrowUpFromLine,
  ExternalLink,
  GitBranch,
  History,
  Loader2,
  RotateCcw,
} from "lucide-react";

type GitSync = {
  connected: boolean;
  inSync: boolean | null;
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
  canWrite: boolean;
  onRestored?: () => void;
};

export function PipelineGitPanel({ pipelineId, canWrite, onRestored }: Props) {
  const [loading, setLoading] = useState(true);
  const [sync, setSync] = useState<GitSync | null>(null);
  const [gitHistory, setGitHistory] = useState<GitCommit[]>([]);
  const [revisions, setRevisions] = useState<Revision[]>([]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [diffSha, setDiffSha] = useState<string | null>(null);
  const [diffLines, setDiffLines] = useState<Array<{ type: string; text: string }>>([]);

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
      const data = (await res.json()) as { error?: string; compareUrl?: string; htmlUrl?: string };
      if (!res.ok) throw new Error(data.error ?? "Action failed");
      if (data.compareUrl) window.open(data.compareUrl, "_blank", "noopener,noreferrer");
      await load();
      onRestored?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed");
    } finally {
      setBusy(null);
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

  const repoUrl =
    sync?.repo != null
      ? `https://github.com/${sync.repo.owner}/${sync.repo.name}/blob/${sync.repo.productionBranch}/${sync.path ?? ""}`
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
              "Edit in dev → save pushes to develop. Deploy promotes definition + bindings to production branch (CI/CD)."}
          </p>
        </div>
        {sync?.inSync === false ? (
          <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            Unsynced
          </span>
        ) : sync?.inSync === true ? (
          <span className="shrink-0 rounded bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200">
            In sync
          </span>
        ) : null}
      </div>

      {error ? <p className="text-[10px] text-red-600 dark:text-red-400">{error}</p> : null}

      {canWrite ? (
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void runAction({ action: "promote_to_production" }, "deploy-prod")}
            className="inline-flex items-center gap-1 rounded-md bg-violet-600 px-2 py-1 text-[10px] font-medium text-white hover:bg-violet-700 disabled:opacity-50"
          >
            {busy === "deploy-prod" ? <Loader2 className="h-3 w-3 animate-spin" /> : <ArrowUpFromLine className="h-3 w-3" />}
            Deploy to production
          </button>
          <button
            type="button"
            disabled={!!busy}
            onClick={() => void runAction({ action: "push", branch: "development" }, "push-dev")}
            className="inline-flex items-center gap-1 rounded-md border border-slate-300 bg-white px-2 py-1 text-[10px] font-medium text-slate-700 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200"
          >
            Push YAML to develop
          </button>
          {repoUrl ? (
            <a
              href={repoUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1 rounded-md border border-slate-300 px-2 py-1 text-[10px] font-medium text-slate-600 hover:bg-white dark:border-slate-600 dark:text-slate-300"
            >
              <ExternalLink className="h-3 w-3" /> Open in GitHub
            </a>
          ) : null}
        </div>
      ) : null}

      {gitHistory.length > 0 ? (
        <div>
          <p className="mb-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">Git commits</p>
          <ul className="max-h-36 space-y-1 overflow-y-auto">
            {gitHistory.map((c) => (
              <li key={c.sha} className="flex items-start justify-between gap-2 rounded border border-slate-200/80 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                <span className="min-w-0">
                  <span className="font-mono text-[10px] text-violet-600 dark:text-violet-300">{c.sha}</span>
                  <span className="block truncate text-[10px] text-slate-700 dark:text-slate-300">{c.message}</span>
                </span>
                {canWrite ? (
                  <span className="flex shrink-0 gap-1">
                    <button
                      type="button"
                      title="Diff vs current"
                      className="text-[10px] text-slate-500 hover:text-slate-800"
                      onClick={() => void showDiff(c.fullSha)}
                    >
                      Diff
                    </button>
                    <button
                      type="button"
                      disabled={!!busy}
                      title="Restore this commit"
                      className="text-slate-500 hover:text-slate-800"
                      onClick={() => void runAction({ action: "restore_git", commitSha: c.fullSha }, `restore-${c.sha}`)}
                    >
                      {busy === `restore-${c.sha}` ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    </button>
                  </span>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {revisions.length > 0 ? (
        <div>
          <p className="mb-1 flex items-center gap-1 text-[10px] font-medium uppercase tracking-wide text-slate-500">
            <History className="h-3 w-3" /> Save history (Neon)
          </p>
          <ul className="max-h-28 space-y-1 overflow-y-auto">
            {revisions.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-2 rounded border border-slate-200/80 bg-white px-2 py-1 dark:border-slate-700 dark:bg-slate-900">
                <span className="min-w-0 text-[10px] text-slate-600 dark:text-slate-400">
                  {new Date(r.createdAt).toLocaleString()} — {r.message ?? "Save"}
                </span>
                {canWrite ? (
                  <button
                    type="button"
                    disabled={!!busy}
                    className="shrink-0 text-slate-500 hover:text-slate-800"
                    onClick={() => void runAction({ action: "restore_revision", revisionId: r.id }, r.id)}
                  >
                    {busy === r.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                  </button>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      {diffSha && diffLines.length > 0 ? (
        <pre className="max-h-40 overflow-auto rounded border border-slate-200 bg-white p-2 font-mono text-[9px] leading-relaxed dark:border-slate-700 dark:bg-slate-950">
          {diffLines.map((line, i) => (
            <div
              key={`${i}-${line.type}`}
              className={clsx(
                line.type === "add" && "bg-emerald-50 text-emerald-900 dark:bg-emerald-950/40",
                line.type === "remove" && "bg-red-50 text-red-900 dark:bg-red-950/40"
              )}
            >
              {line.type === "add" ? "+ " : line.type === "remove" ? "- " : "  "}
              {line.text}
            </div>
          ))}
        </pre>
      ) : null}
    </section>
  );
}
