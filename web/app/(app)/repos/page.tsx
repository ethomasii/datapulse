import Link from "next/link";
import { FolderGit2, Plug } from "lucide-react";
import { requireDbUser } from "@/lib/auth/server";
import { UpcomingFeaturePage } from "@/components/app/upcoming-feature-page";
import { formatDefaultRepoLabel, getGithubConnectionForUser } from "@/lib/db/github-connection-query";

export default async function ReposPage() {
  const user = await requireDbUser();
  const { row: gh, githubTableMissing } = await getGithubConnectionForUser(user.id);
  const defaultRepoLabel = formatDefaultRepoLabel(gh);

  const actions = (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
        <Link
          href="/integrations"
          className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
        >
          <Plug className="h-4 w-4" aria-hidden />
          Connect &amp; integration settings
        </Link>
        <Link
          href="/builder"
          className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
        >
          <FolderGit2 className="h-4 w-4" aria-hidden />
          Pipelines (export code to your repo)
        </Link>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 dark:border-slate-700 dark:bg-slate-900/60">
        <h3 className="text-sm font-semibold text-slate-900 dark:text-white">Repository connection</h3>
        {githubTableMissing ? (
          <p className="mt-2 text-sm text-amber-900 dark:text-amber-100/90">
            GitHub connection storage isn&apos;t in this database yet. From <code className="rounded bg-amber-100 px-1 text-xs dark:bg-amber-950">web/</code>, run{" "}
            <code className="rounded bg-amber-100 px-1 text-xs dark:bg-amber-950">npm run db:push</code> with{" "}
            <code className="rounded bg-amber-100 px-1 text-xs dark:bg-amber-950">DATABASE_URL</code> set.
          </p>
        ) : gh?.githubLogin ? (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            Optional GitHub (BYO) connected as <span className="font-medium text-slate-900 dark:text-white">@{gh.githubLogin}</span>
            {defaultRepoLabel ? (
              <>
                . Default repo:{" "}
                <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">{defaultRepoLabel}</code>
              </>
            ) : (
              <span className="text-slate-500">. Set a default owner/repo under Integrations when you enable BYO.</span>
            )}
          </p>
        ) : (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-300">
            No personal GitHub OAuth linked yet. The default product targets <strong className="font-medium">managed</strong>{" "}
            repos under eltPulse&apos;s org (service credentials). For experiments, optional BYO OAuth lives in{" "}
            <Link href="/integrations" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Integrations
            </Link>
            .
          </p>
        )}
        <div className="mt-4 rounded-lg border border-dashed border-slate-200 bg-slate-50/80 p-4 text-sm text-slate-600 dark:border-slate-600 dark:bg-slate-950/40 dark:text-slate-400">
          <p className="font-medium text-slate-800 dark:text-slate-200">Browse repository contents</p>
          <p className="mt-1">
            Branch and path browser (files, last commit, open in GitHub) will show here after GitHub App installation and
            API wiring. Until then, use your Git host directly or export artifacts from{" "}
            <Link href="/builder" className="text-sky-600 hover:underline dark:text-sky-400">
              Pipelines
            </Link>{" "}
            → Code.
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <UpcomingFeaturePage
      eyebrow="Product · Git"
      title="Repositories"
      summary="Pick the default GitHub repository and branch where eltPulse writes pipeline definitions — all under your organization’s GitHub App. Customers keep using eltPulse only; they never need to OAuth to GitHub for the default product."
      eta="2026 — GitHub App + commit automation"
      actions={actions}
      focusAreas={[
        {
          title: "What this page will do",
          bullets: [
            "List repos the installation can access; pick default owner/repo per workspace.",
            "Choose branch and path prefix (e.g. eltpulse/pipelines/).",
            "Show last sync commit and diff summary when we push updates from the builder.",
          ],
        },
        {
          title: "Layout",
          bullets: [
            "Follows the eltpulse/ tree documented in /docs/repositories.",
            "Workspace YAML and pipeline code stay reviewable in PRs like application code.",
          ],
        },
      ]}
      expectations={[
        "Connect managed Git settings under Integrations when your org is onboarded.",
        "Until then, copy artifacts from the Code modal into your repo manually.",
        <>
          Read{" "}
          <Link href="/docs/repositories" className="text-sky-600 underline dark:text-sky-400">
            Repositories in the docs
          </Link>{" "}
          for the target layout.
        </>,
      ]}
    />
  );
}
