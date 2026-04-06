import Link from "next/link";
import { Suspense } from "react";
import { requireDbUser } from "@/lib/auth/server";
import {
  formatDefaultRepoLabel,
  getGithubConnectionForUser,
} from "@/lib/db/github-connection-query";
import { githubOAuthRedirectUri } from "@/lib/integrations/github-app-url";
import { isCustomerGithubOauthEnabled } from "@/lib/integrations/customer-github-oauth";
import { IntegrationsClient } from "./integrations-client";

export default async function IntegrationsPage() {
  const user = await requireDbUser();
  const { row: ghRow, githubTableMissing } = await getGithubConnectionForUser(user.id);
  const defaultRepoLabel = formatDefaultRepoLabel(ghRow);

  return (
    <div className="w-full min-w-0 max-w-3xl space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Integrations</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Connect <strong className="font-medium text-slate-800 dark:text-slate-200">accounts and services</strong>{" "}
          DataPulse uses alongside your data plane — GitHub (optional BYO), and later Slack, webhooks, email, and
          notification channels.
        </p>
        <p className="mt-3 rounded-xl border border-slate-200 bg-slate-50/90 p-4 text-sm text-slate-600 dark:border-slate-700 dark:bg-slate-900/50 dark:text-slate-300">
          <span className="font-medium text-slate-800 dark:text-slate-200">Pipelines</span> live under{" "}
          <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            Pipelines
          </Link>
          : they are your <strong className="font-medium">source → destination</strong> definitions (what to move and
          how). <span className="font-medium text-slate-800 dark:text-slate-200">Integrations</span> here are{" "}
          <strong className="font-medium">product connectivity</strong> — not the ELT routes themselves.
        </p>
      </div>

      <Suspense
        fallback={<div className="h-32 animate-pulse rounded-2xl bg-slate-100 dark:bg-slate-800" aria-hidden />}
      >
        <IntegrationsClient
          githubLogin={ghRow?.githubLogin ?? null}
          defaultRepoLabel={defaultRepoLabel}
          oauthCallbackUrl={githubOAuthRedirectUri()}
          showCustomerGithubOauth={isCustomerGithubOauthEnabled()}
          githubTableMissing={githubTableMissing}
        />
      </Suspense>
    </div>
  );
}
