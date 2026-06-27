import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Orchestration",
  description:
    "Cron schedules, monitors, run slices, pipeline chains, and portable exports for external orchestrators.",
};

export default function OrchestrationDocsPage() {
  return (
    <DocsProse>
      <h1>Orchestration</h1>
      <p>
        eltPulse separates <strong>definitions</strong> (pipelines, code, assets) from <strong>orchestration</strong>{" "}
        (when and how work runs). You can orchestrate entirely in eltPulse — schedules, monitors, chains, slices — or
        export the same artifacts to Airflow, Prefect, GitHub Actions, or a custom runner.
      </p>

      <h2>Schedules</h2>
      <p>
        <Link href="/schedule">Schedules</Link> shows every pipeline with cron configuration. Enable sync schedules and
        optional separate <strong>dbt phases</strong> (run transform after load on its own cadence). Cron uses standard
        five-field syntax with timezone support; the cloud scheduler enqueues runs on eltPulse-managed workers unless
        the pipeline targets a customer gateway.
      </p>
      <p>
        Schedule metadata is also emitted in <code>eltpulse_workspace.yaml</code> for external orchestrators.
      </p>

      <h2>Monitors (event triggers)</h2>
      <p>
        <strong>Monitors</strong> react to events — S3 object lands, SQS messages, custom webhooks — instead of clock
        time. Each monitor has its own <strong>Runs on</strong> setting:
      </p>
      <ul>
        <li>
          <strong>eltPulse-managed</strong> — cloud evaluates checks and enqueues runs.
        </li>
        <li>
          <strong>Customer gateway</strong> — your gateway evaluates S3/SQS (or custom worker) and POSTs results to the
          control plane.
        </li>
      </ul>
      <p>
        Monitors link to a saved <Link href="/connections">connection</Link> when cloud API credentials are required.
        Configure monitors and slice values on <Link href="/orchestration">Orchestration</Link> in the app.
      </p>

      <h2>Run slices</h2>
      <p>
        Monitors and manual runs can pass a <strong>slice value</strong> (<code>partition_key</code> in generated code)
        to scope incremental windows or backfills. Set the partition column on{" "}
        <Link href="/run-slices">Run slices</Link>; monitors can supply one value per line in{" "}
        <code>partition_values</code>. See <Link href="/docs/run-slices">Run slices (docs)</Link>.
      </p>

      <h2>Pipeline chains</h2>
      <p>
        <Link href="/workflows">Pipeline chains</Link> define DAG edges between pipelines — e.g. run downstream dbt
        staging only after upstream SaaS sync succeeds. Native chains avoid webhook glue for in-product dependencies;
        use <Link href="/docs/webhooks">Webhooks</Link> for external systems.
      </p>

      <h2>Where it appears in the product</h2>
      <ul>
        <li>
          <Link href="/builder">Pipelines</Link> — definitions, canvas, exports.
        </li>
        <li>
          <Link href="/schedule">Schedules</Link> — cron overview.
        </li>
        <li>
          <Link href="/orchestration">Orchestration</Link> — monitors and slice-aware triggers.
        </li>
        <li>
          <Link href="/workflows">Pipeline chains</Link> — success/failure edges between pipelines.
        </li>
        <li>
          <Link href="/runs">Runs</Link> — execution history and telemetry.
        </li>
        <li>
          <Link href="/observability">Metrics</Link> — trends, filters, alert rules.
        </li>
        <li>
          <code>eltpulse_workspace.yaml</code> — scheduling and resilience metadata for portable automation.
        </li>
      </ul>

      <h2>Roadmap</h2>
      <p>
        Deeper sensor UX, cross-workspace orchestration patterns, and more native scheduling features are on the{" "}
        <Link href="/roadmap">roadmap</Link>. Targeting and data model details:{" "}
        <Link href="/docs/concepts">Concepts</Link> · gateway deployment:{" "}
        <Link href="/docs/gateway">Gateway</Link>.
      </p>
    </DocsProse>
  );
}
