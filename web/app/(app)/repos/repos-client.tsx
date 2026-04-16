"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ArrowDownToLine, ArrowUpFromLine, BookOpen, Check, Loader2, Plug } from "lucide-react";
import type { GithubConnectionSummary } from "@/lib/db/github-connection-query";

type PipelineRow = {
  id: string;
  name: string;
  sourceType: string;
  destinationType: string;
  enabled: boolean;
  updatedAt: string;
};

type RepoOption = {
  fullName: string;
  name: string;
  private: boolean;
  defaultBranch: string;
};

type Props = {
  githubLogin: string | null;
  initialConnection: GithubConnectionSummary | null;
  githubTableMissing: boolean;
  showCustomerGithubOauth: boolean;
};

export function RepositoriesClient({
  githubLogin,
  initialConnection,
  githubTableMissing,
  showCustomerGithubOauth,
}: Props) {
  const [owner, setOwner] = useState(initialConnection?.defaultRepoOwner ?? "");
  const [repoName, setRepoName] = useState(initialConnection?.defaultRepoName ?? "");
  const [branch, setBranch] = useState(initialConnection?.defaultBranch ?? "main");

  const [repos, setRepos] = useState<RepoOption[] | null>(null);
  const [loadingRepos, setLoadingRepos] = useState(false);
  const [repoQuery, setRepoQuery] = useState("");

  const [saving, setSaving] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const [pipelines, setPipelines] = useState<PipelineRow[] | null>(null);
  const [loadingPipelines, setLoadingPipelines] = useState(false);
  const [pulling, setPulling] = useState(false);
  const [pushingId, setPushingId] = useState<string | null>(null);

  useEffect(() => {
    setOwner(initialConnection?.defaultRepoOwner ?? "");
    setRepoName(initialConnection?.defaultRepoName ?? "");
    setBranch(initialConnection?.defaultBranch ?? "main");
  }, [initialConnection?.defaultRepoOwner, initialConnection?.defaultRepoName, initialConnection?.defaultBranch]);

  const loadPipelines = useCallback(async () => {
    setLoadingPipelines(true);
    try {
      const res = await fetch("/api/elt/pipelines");
      const json = (await res.json()) as { pipelines?: PipelineRow[] };
      if (!res.ok) throw new Error("Could not load pipelines");
      setPipelines(json.pipelines ?? []);
    } catch {
      setPipelines([]);
      setBanner({ kind: "err", text: "Could not load pipelines." });
    } finally {
      setLoadingPipelines(false);
    }
  }, []);

  useEffect(() => {
    void loadPipelines();
  }, [loadPipelines]);

  async function saveDefaults() {
    setSaving(true);
    setBanner(null);
    try {
      const res = await fetch("/api/integrations/github", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          defaultRepoOwner: owner.trim() || null,
          defaultRepoName: repoName.trim() || null,
          defaultBranch: branch.trim() || null,
        }),
      });
      const json = (await res.json()) as { error?: unknown };
      if (!res.ok) {
        const msg = typeof json.error === "string" ? json.error : "Save failed";
        throw new Error(msg);
      }
      setBanner({ kind: "ok", text: "Saved default repository and branch." });
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Save failed" });
    } finally {
      setSaving(false);
    }
  }

  async function fetchRepoList() {
    if (!githubLogin) return;
    setLoadingRepos(true);
    setBanner(null);
    try {
      const qs = repoQuery.trim() ? `?q=${encodeURIComponent(repoQuery.trim())}` : "";
      const res = await fetch(`/api/integrations/github/repos${qs}`);
      const json = (await res.json()) as { repos?: RepoOption[]; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Could not list repositories");
      setRepos(json.repos ?? []);
    } catch (e) {
      setRepos([]);
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Could not list repositories" });
    } finally {
      setLoadingRepos(false);
    }
  }

  function pickRepo(r: RepoOption) {
    const [o, n] = r.fullName.split("/");
    if (o && n) {
      setOwner(o);
      setRepoName(n);
      setBranch(r.defaultBranch || "main");
    }
    setRepos(null);
  }

  async function pullDeclarations() {
    setPulling(true);
    setBanner(null);
    try {
      const res = await fetch("/api/integrations/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "pull_declarations" }),
      });
      const json = (await res.json()) as {
        ok?: boolean;
        applied?: string[];
        errors?: { path: string; message: string }[];
        error?: string;
      };
      if (!res.ok) throw new Error(json.error ?? "Pull failed");
      const n = json.applied?.length ?? 0;
      const errN = json.errors?.length ?? 0;
      setBanner({
        kind: errN ? "err" : "ok",
        text:
          `Imported ${n} pipeline(s) from eltpulse/pipelines.` +
          (errN ? ` ${errN} file(s) skipped (see response in network tab for details).` : ""),
      });
      await loadPipelines();
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Pull failed" });
    } finally {
      setPulling(false);
    }
  }

  async function pushPipeline(id: string) {
    setPushingId(id);
    setBanner(null);
    try {
      const res = await fetch("/api/integrations/github/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "push_pipeline", pipelineId: id }),
      });
      const json = (await res.json()) as { ok?: boolean; path?: string; htmlUrl?: string | null; error?: string };
      if (!res.ok) throw new Error(json.error ?? "Push failed");
      const urlNote = json.htmlUrl ? ` Open: ${json.htmlUrl}` : "";
      setBanner({ kind: "ok", text: `Pushed ${json.path ?? "file"}.${urlNote}` });
    } catch (e) {
      setBanner({ kind: "err", text: e instanceof Error ? e.message : "Push failed" });
    } finally {
      setPushingId(null);
    }
  }

  const canSync = Boolean(githubLogin && owner.trim() && repoName.trim() && branch.trim());

  if (githubTableMissing) {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100">
        <p className="font-medium">GitHub connection storage is not in this database.</p>
        <p className="mt-2">
          From <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">web/</code>, run{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">npm run db:push</code> with{" "}
          <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">DATABASE_URL</code> set.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-10">
      {banner && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Git connection</h2>
        {!githubLogin ? (
          <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Connect your GitHub account (optional BYO) to read and write{" "}
              <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">eltpulse/pipelines/*.yaml</code> in a
              repository you choose.
            </p>
            {showCustomerGithubOauth ? (
              <Link
                href="/api/integrations/github/start"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900"
              >
                <Plug className="h-4 w-4" aria-hidden />
                Connect GitHub
              </Link>
            ) : (
              <p className="rounded-lg border border-slate-200 bg-slate-50 p-3 dark:border-slate-700 dark:bg-slate-950/50">
                Customer GitHub OAuth is disabled on this deployment (
                <code className="text-xs">CUSTOMER_GITHUB_OAUTH_ENABLED</code>). The default product uses managed repos;
                enable BYO OAuth for this flow, or use the API / CI to apply declarations.
              </p>
            )}
            <p>
              <Link href="/integrations" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                Integrations
              </Link>{" "}
              ·{" "}
              <Link href="/docs/repositories" className="inline-flex items-center gap-1 font-medium text-sky-600 hover:underline dark:text-sky-400">
                <BookOpen className="h-3.5 w-3.5" aria-hidden />
                Repository layout
              </Link>
            </p>
          </div>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Connected as <span className="font-semibold text-slate-900 dark:text-white">@{githubLogin}</span>. Pipeline
            declarations sync to <span className="font-mono text-xs">eltpulse/pipelines/&lt;name&gt;.yaml</span> on the
            branch you set below.
          </p>
        )}
      </section>

      {githubLogin ? (
        <>
          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Default repository</h2>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Used for <strong className="font-medium text-slate-800 dark:text-slate-200">Pull</strong> and{" "}
              <strong className="font-medium text-slate-800 dark:text-slate-200">Push</strong>. Scope{" "}
              <code className="text-xs">repo</code> is required on the OAuth app so we can commit.
            </p>

            <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-end">
              <label className="block min-w-[8rem] flex-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Owner</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  value={owner}
                  onChange={(e) => setOwner(e.target.value)}
                  placeholder="org-or-user"
                  autoComplete="off"
                />
              </label>
              <label className="block min-w-[8rem] flex-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Repository</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  value={repoName}
                  onChange={(e) => setRepoName(e.target.value)}
                  placeholder="my-data-repo"
                  autoComplete="off"
                />
              </label>
              <label className="block min-w-[8rem] flex-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Branch</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  value={branch}
                  onChange={(e) => setBranch(e.target.value)}
                  placeholder="main"
                  autoComplete="off"
                />
              </label>
              <button
                type="button"
                onClick={() => void saveDefaults()}
                disabled={saving}
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-50 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" aria-hidden />}
                Save
              </button>
            </div>

            <div className="mt-6 flex flex-col gap-3 border-t border-slate-100 pt-6 dark:border-slate-800 sm:flex-row sm:items-end">
              <label className="block max-w-md flex-1 text-sm">
                <span className="text-slate-600 dark:text-slate-400">Filter (optional)</span>
                <input
                  className="mt-1 w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 dark:border-slate-600 dark:bg-slate-950 dark:text-white"
                  value={repoQuery}
                  onChange={(e) => setRepoQuery(e.target.value)}
                  placeholder="substring of owner/repo"
                />
              </label>
              <button
                type="button"
                onClick={() => void fetchRepoList()}
                disabled={loadingRepos}
                className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
              >
                {loadingRepos ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Load my repositories
              </button>
            </div>

            {repos && repos.length > 0 && (
              <ul className="mt-4 max-h-56 overflow-auto rounded-lg border border-slate-200 dark:border-slate-700">
                {repos.map((r) => (
                  <li key={r.fullName} className="border-b border-slate-100 last:border-0 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={() => pickRepo(r)}
                      className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-slate-50 dark:hover:bg-slate-800/80"
                    >
                      <span className="font-mono text-xs text-slate-900 dark:text-white">{r.fullName}</span>
                      <span className="text-xs text-slate-500">{r.private ? "Private" : "Public"}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
            {repos && repos.length === 0 && (
              <p className="mt-3 text-sm text-slate-500 dark:text-slate-400">No repositories matched.</p>
            )}
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Pull from repo</h2>
              <button
                type="button"
                disabled={!canSync || pulling}
                onClick={() => void pullDeclarations()}
                className="inline-flex items-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-700 disabled:opacity-50 dark:bg-sky-500 dark:hover:bg-sky-600"
              >
                {pulling ? <Loader2 className="h-4 w-4 animate-spin" /> : <ArrowDownToLine className="h-4 w-4" aria-hidden />}
                Import YAML into eltPulse
              </button>
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Reads every <code className="text-xs">*.yaml</code> / <code className="text-xs">*.yml</code> under{" "}
              <code className="text-xs">eltpulse/pipelines</code> and upserts pipelines by name (same as{" "}
              <code className="text-xs">POST /api/elt/pipelines/declaration?mode=upsert</code>
              ).
            </p>
          </section>

          <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Push to repo</h2>
              {loadingPipelines ? (
                <Loader2 className="h-5 w-5 animate-spin text-slate-400" aria-label="Loading" />
              ) : null}
            </div>
            <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
              Writes each pipeline as a declarative YAML file. Existing files are updated on the same branch.
            </p>

            {!pipelines || pipelines.length === 0 ? (
              <p className="mt-4 text-sm text-slate-500 dark:text-slate-400">
                No pipelines yet.{" "}
                <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
                  Create one in the builder
                </Link>
                .
              </p>
            ) : (
              <ul className="mt-4 divide-y divide-slate-100 dark:divide-slate-800">
                {pipelines.map((p) => (
                  <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 py-3 first:pt-0">
                    <div>
                      <div className="font-medium text-slate-900 dark:text-white">{p.name}</div>
                      <div className="text-xs text-slate-500 dark:text-slate-400">
                        {p.sourceType} → {p.destinationType}
                        {!p.enabled ? " · disabled" : ""}
                      </div>
                    </div>
                    <button
                      type="button"
                      disabled={!canSync || pushingId === p.id}
                      onClick={() => void pushPipeline(p.id)}
                      className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-1.5 text-sm font-medium text-slate-800 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                    >
                      {pushingId === p.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <ArrowUpFromLine className="h-4 w-4" aria-hidden />
                      )}
                      Push YAML
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      ) : null}
    </div>
  );
}
