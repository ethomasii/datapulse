import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Repositories",
  description: "eltpulse/ repository layout and managed Git.",
};

export default function RepositoriesDocsPage() {
  return (
    <DocsProse>
      <h1>Repositories</h1>
      <p>
        Each customer workspace will map to a <strong>private repository</strong> under your GitHub organization. The
        on-disk layout uses a dedicated top-level folder so it stays distinct from arbitrary application code:
      </p>
      <pre className="not-prose overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
        {`repo/
    eltpulse/
    pipelines/
      my_pipeline/
        pipeline.py          # or replication.yaml
        config.yaml
    eltpulse_workspace.yaml   # optional per-repo aggregate (future)`}
      </pre>

      <h2>Workspace manifest</h2>
      <p>
        Generated <code>eltpulse_workspace.yaml</code> (stored alongside definitions in the app) describes scheduling
        hints, retries, and a logical code location for automation — consumable by eltPulse or by an external
        orchestrator (Airflow, Prefect, etc.) if you prefer to run triggers outside our control plane.
      </p>

      <h2>Status</h2>
      <p>
        Automated commits from the app into managed repos are <strong>in development</strong>. Today, use{" "}
        <strong>Code</strong> in the builder to copy files into the repo your runners use.
      </p>

      <p>
        <Link href="/repos">Repositories (app preview)</Link> · <Link href="/docs/concepts">Concepts</Link>
      </p>
    </DocsProse>
  );
}
