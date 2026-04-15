import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Orchestration",
  description:
    "Schedules, eltPulse monitors, run slices, and portable pipeline definitions for your own runners and orchestrators.",
};

export default function OrchestrationDocsPage() {
  return (
    <DocsProse>
      <h1>Orchestration</h1>
      <p>
        eltPulse keeps <strong>definitions</strong> and <strong>orchestration</strong> separate: definitions describe
        what runs (pipelines, code, assets), while orchestration covers when and how work runs — schedules, monitors,
        run slices, and run policies. We aim to be the <strong>enterprise-grade</strong> place to run that
        orchestration end-to-end, while keeping exports and contracts <strong>portable</strong> so you are never locked
        in. The same artifacts can be driven by eltPulse or by tools you already use — Airflow, Prefect, GitHub
        Actions, or a custom runner — because we want customers who <em>choose</em> us, not customers who are stuck.
      </p>

      <h2>Schedules and monitors</h2>
      <p>
        <strong>Schedules</strong> are time-based (cron). <strong>Monitors</strong> react to events (files, webhooks,
        upstream completions). Both belong in the orchestration layer, not embedded as opaque strings inside EL
        connectors.
      </p>
      <p>
        In-product, event triggers are <strong>eltPulse monitors</strong>. Each monitor has its own{" "}
        <strong>Runs on</strong> setting (inherit account plane, always eltPulse-managed cron, or always your gateway):
        when checks are customer-side, your gateway evaluates S3/SQS (or your custom worker) and{" "}
        <code>POST</code>s results to the control plane; when eltPulse-managed, the cloud cron evaluates them. Monitors
        link to a saved <Link href="/connections">connection</Link> when the monitor type needs cloud API credentials.
      </p>
      <p>
        <strong>Run checks</strong> in the app only runs monitors that eltPulse is allowed to evaluate in the cloud;
        gateway-only monitors are skipped there. See <Link href="/docs/concepts">Concepts</Link> for how monitors relate
        to pipelines and connections, and <Link href="/docs/gateway">Gateway</Link> for the agent API.
      </p>

      <h2>Run slices</h2>
      <p>
        For backfills and incremental windows, runs can carry a slice key (often exposed as{" "}
        <code>partition_key</code> in generated Python for compatibility). The Run slices page in the app is where you
        configure that strategy per pipeline.
      </p>

      <h2>Where it appears in the product</h2>
      <ul>
        <li>
          <Link href="/builder">Pipelines</Link> — definitions and exports.
        </li>
        <li>
          <code>eltpulse_workspace.yaml</code> — <code>scheduling</code> and resilience metadata next to generated code.
        </li>
        <li>
          <Link href="/runs">Runs</Link> (signed in) — execution history reported by your runner or CI.
        </li>
        <li>
          <Link href="/gateway">Gateway</Link> (signed in) — tokens and defaults for self-hosted execution.
        </li>
        <li>
          <Link href="/docs/gateway">Gateway (docs)</Link> — how the agent process works and how to deploy it.
        </li>
      </ul>

      <h2>Roadmap</h2>
      <p>
        First-class schedule and sensor experiences in the product, deeper native orchestration, and ongoing
        interoperability with external engines are tracked on the <Link href="/roadmap">roadmap</Link>. For targeting and
        data model details, see <Link href="/docs/concepts">Concepts</Link>.
      </p>
    </DocsProse>
  );
}
