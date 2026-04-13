import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Getting started",
  description: "Create an account and your first pipeline in eltPulse.",
};

export default function GettingStartedDocsPage() {
  return (
    <DocsProse>
      <h1>Getting started</h1>
      <p>
        eltPulse uses <strong>Clerk</strong> for authentication. After you sign up, we provision a user row in our
        database and you land on the <Link href="/dashboard">dashboard</Link>.
      </p>

      <h2>1. Create a pipeline</h2>
      <ol>
        <li>
          Open <Link href="/builder">Pipelines</Link>.
        </li>
        <li>
          Pick a <strong>name</strong> (snake_case), <strong>source</strong>, and <strong>destination</strong>.
        </li>
        <li>
          Use <strong>Guided</strong> mode for GitHub or REST, or <strong>JSON</strong> for advanced configuration.
        </li>
        <li>
          Submit — we store the definition and generate <code>pipeline.py</code> or <code>replication.yaml</code>,{" "}
          <code>config.yaml</code>, and <code>eltpulse_workspace.yaml</code>.
        </li>
      </ol>

      <h2>2. Review generated files</h2>
      <p>
        From the pipeline table, open <strong>Code</strong> to copy artifacts. Save them under{" "}
        <code>eltpulse/pipelines/&lt;name&gt;/</code> in your managed repository when Git sync is connected.
      </p>

      <h2>3. Credentials</h2>
      <p>
        We never store source passwords in the product UI beyond optional BYO GitHub OAuth tokens (when enabled). Set
        environment variables in the runner or repo where you execute pipelines — see the sidebar hints on the builder
        for common keys (e.g. <code>GITHUB_TOKEN</code>, destination DSNs).
      </p>

      <h2>Next</h2>
      <ul>
        <li>
          <Link href="/docs/pipelines">Pipelines — concepts</Link>
        </li>
        <li>
          <Link href="/integrations">Integrations (app)</Link>
        </li>
      </ul>
    </DocsProse>
  );
}
