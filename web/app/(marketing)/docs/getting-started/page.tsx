import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Getting started",
  description: "Create an account and your first pipeline in minutes — managed execution, canvas, and Pulse AI.",
};

export default function GettingStartedDocsPage() {
  return (
    <DocsProse>
      <h1>Getting started</h1>
      <p>
        eltPulse uses <strong>Clerk</strong> for authentication. After you sign up, we provision your workspace and you
        land on the <Link href="/dashboard">dashboard</Link>. No Docker or gateway setup is required —{" "}
        <strong>managed execution</strong> is the default.
      </p>

      <h2>Fastest path: Quick start</h2>
      <ol>
        <li>
          Open <Link href="/quick-start">Quick start</Link> from the sidebar.
        </li>
        <li>
          Pick a <strong>destination</strong> (e.g. Snowflake, BigQuery, Postgres), then a <strong>source</strong>.
        </li>
        <li>
          Enter credentials (or link a saved <Link href="/connections">connection</Link>) and click{" "}
          <strong>Create &amp; run</strong>.
        </li>
      </ol>
      <p>
        eltPulse generates production-ready dlt or Sling code, starts a run on managed workers, and streams telemetry
        to the <Link href="/runs">Runs</Link> page.
      </p>

      <h2>Full builder: catalog, Pulse AI, or manual</h2>
      <ol>
        <li>
          Open <Link href="/builder">Pipelines</Link>.
        </li>
        <li>
          Choose <strong>Browse catalog</strong>, <strong>Pulse AI</strong>, or <strong>Manual</strong> create
          mode.
        </li>
        <li>
          Set a <strong>name</strong> (snake_case), <strong>source</strong>, and <strong>destination</strong>.
        </li>
        <li>
          Configure credentials inline or link saved connections. Use <strong>Guided</strong> mode for structured
          connectors or <strong>JSON</strong> for advanced config.
        </li>
        <li>
          Optional: add post-load <strong>dbt</strong>, configure <Link href="/run-slices">run slices</Link>, or open
          the <Link href="/builder?view=canvas">visual canvas</Link> after save.
        </li>
        <li>
          Submit — we store the definition and generate <code>pipeline.py</code> or <code>replication.yaml</code>,{" "}
          <code>config.yaml</code>, and <code>eltpulse_workspace.yaml</code>.
        </li>
      </ol>

      <h2>Visual canvas</h2>
      <p>
        The <Link href="/builder?view=canvas">canvas</Link> is a visual graph editor for the same pipeline as
        the form builder. Drag source, transform, and destination nodes; wire edges; inspect dbt and post-transform
        settings on transform nodes. Pulse AI can patch the graph from chat — see{" "}
        <Link href="/docs/ai-builder">Pulse AI</Link>.
      </p>

      <h2>Review generated files</h2>
      <p>
        From the pipeline table, open <strong>Code</strong> to copy artifacts. When GitHub is connected under{" "}
        <Link href="/repos">Repositories</Link>, pipeline YAML can <strong>auto-push on save</strong> (Pro+; disable
        with <code>ELTPULSE_AUTO_GIT_PUSH=false</code>). Manual copy still works into{" "}
        <code>eltpulse/pipelines/&lt;name&gt;/</code>.
      </p>

      <h2>Credentials</h2>
      <p>
        Save reusable profiles on <Link href="/connections">Connections</Link> — secrets are encrypted at rest.
        Pipelines link optional source/destination connection ids; generated YAML may include resolved connection names
        for runners. Gateways fetch decrypted profiles via <code>GET /api/agent/connections</code>.
      </p>

      <h2>Next</h2>
      <ul>
        <li>
          <Link href="/docs/concepts">Concepts</Link> — pipelines, runs, connections, monitors, gateways.
        </li>
        <li>
          <Link href="/docs/ai-builder">Pulse AI</Link> — natural-language pipeline creation.
        </li>
        <li>
          <Link href="/docs/run-slices">Run slices</Link> — backfills and incremental windows.
        </li>
        <li>
          <Link href="/docs/connectors">Connectors</Link> — catalog tiers and sync modes.
        </li>
        <li>
          <Link href="/schedule">Schedules</Link> — cron on pipelines and dbt phases.
        </li>
        <li>
          <Link href="/docs/gateway">Gateway</Link> — when you need execution in your VPC.
        </li>
      </ul>
    </DocsProse>
  );
}
