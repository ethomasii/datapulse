import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Repositories",
  description: "eltpulse/ repository layout, GitHub sync, and auto-push on pipeline save.",
};

export default function RepositoriesDocsPage() {
  return (
    <DocsProse>
      <h1>Repositories</h1>
      <p>
        eltPulse is <strong>Git-native</strong>: pipeline definitions generate real artifacts you can copy, review in
        PRs, or sync to a connected GitHub repository. Manage connections on{" "}
        <Link href="/repos">Repositories</Link> in the app.
      </p>

      <h2>On-disk layout</h2>
      <p>
        Customer repos use a dedicated top-level folder so pipeline code stays distinct from application code:
      </p>
      <pre className="not-prose overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
        {`repo/
  eltpulse/
    pipelines/
      my_pipeline/
        pipeline.py          # or replication.yaml (Sling)
        config.yaml
    eltpulse_workspace.yaml   # optional per-repo aggregate`}
      </pre>

      <h2>GitHub connection</h2>
      <p>
        Connect GitHub under Repositories — managed org provisioning (default) or optional BYO OAuth when enabled by
        your operator. Set default <strong>owner</strong>, <strong>repository</strong>, and <strong>branch</strong> for
        pushes.
      </p>

      <h2>Auto-push on save</h2>
      <p>
        When GitHub is connected, pipeline YAML declarations can <strong>auto-push on every save</strong> (Pro plan and
        above). The push uses the same declarative format as{" "}
        <code>POST /api/elt/pipelines/declaration</code> — idempotent for GitOps workflows. Disable with{" "}
        <code>ELTPULSE_AUTO_GIT_PUSH=false</code> in server env if you prefer manual sync only.
      </p>
      <p>
        Manual <strong>Sync all</strong> and per-pipeline push remain available on the Repositories page. Asset history
        can surface recent GitHub commits for linked pipelines.
      </p>

      <h2>Workspace manifest</h2>
      <p>
        Generated <code>eltpulse_workspace.yaml</code> describes scheduling hints, retries, and a logical code location
        — consumable by eltPulse cron or external orchestrators (Airflow, Prefect, GitHub Actions).
      </p>

      <h2>Manual export</h2>
      <p>
        Without GitHub, open <strong>Code</strong> on any pipeline row to copy artifacts into whatever repo your runners
        use. You always own the generated Python/YAML.
      </p>

      <p>
        <Link href="/repos">Repositories (app)</Link> · <Link href="/docs/pipelines">Pipelines</Link> ·{" "}
        <Link href="/docs/integrations">Integrations</Link> · <Link href="/docs/security">Security</Link>
      </p>
    </DocsProse>
  );
}
