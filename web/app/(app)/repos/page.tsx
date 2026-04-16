import Link from "next/link";
import { FolderGit2, Layers, Plug } from "lucide-react";
import { requireDbUser } from "@/lib/auth/server";
import { formatDefaultRepoLabel, getGithubConnectionForUser } from "@/lib/db/github-connection-query";
import { isCustomerGithubOauthEnabled } from "@/lib/integrations/customer-github-oauth";
import { RelatedLinks } from "@/components/ui/related-links";
import { RepositoriesClient } from "./repos-client";

export default async function ReposPage() {
  const user = await requireDbUser();
  const { row: gh, githubTableMissing } = await getGithubConnectionForUser(user.id);
  const defaultRepoLabel = formatDefaultRepoLabel(gh);

  return (
    <div className="w-full min-w-0 max-w-4xl mx-auto space-y-10">
      <div>
        <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Repositories</h1>
        <p className="mt-2 text-slate-600 dark:text-slate-300">
          Sync declarative pipeline YAML with a GitHub repository: import definitions from{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">eltpulse/pipelines/</code>, or push the
          pipelines you build here back to the same layout (
          <Link href="/docs/repositories" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            docs
          </Link>
          ).
        </p>
        {gh?.githubLogin && defaultRepoLabel ? (
          <p className="mt-2 text-sm text-slate-500 dark:text-slate-400">
            Saved default: <span className="font-mono text-xs">{defaultRepoLabel}</span>
          </p>
        ) : null}
      </div>

      <RepositoriesClient
        githubLogin={gh?.githubLogin ?? null}
        initialConnection={gh}
        githubTableMissing={githubTableMissing}
        showCustomerGithubOauth={isCustomerGithubOauthEnabled()}
      />

      <RelatedLinks
        links={[
          { href: "/integrations", icon: Plug, label: "Integrations", desc: "Connect GitHub (BYO) or read managed-repo notes" },
          { href: "/builder", icon: Layers, label: "Pipelines", desc: "Author pipelines before pushing YAML" },
          { href: "/docs/pipelines", icon: FolderGit2, label: "Declarative API", desc: "YAML shape for POST /api/elt/pipelines/declaration" },
        ]}
      />
    </div>
  );
}
