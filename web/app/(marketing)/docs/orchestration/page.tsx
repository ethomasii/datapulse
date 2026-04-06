import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Orchestration",
  description:
    "Native orchestration on DataPulse plus portable definitions for Airflow, Dagster, Prefect, and other engines.",
};

export default function OrchestrationDocsPage() {
  return (
    <DocsProse>
      <h1>Orchestration</h1>
      <p>
        DataPulse keeps <strong>definitions</strong> and <strong>orchestration</strong> separate: definitions describe
        what runs (pipelines, code, assets), while orchestration covers when and how work runs — schedules, sensors,
        partitions, and run policies. We aim to be the <strong>enterprise-grade</strong> place to run that
        orchestration end-to-end, while keeping exports and contracts <strong>portable</strong> so you are never locked
        in. The same artifacts can be driven by DataPulse or by tools you already use — Airflow, Dagster, Prefect, GitHub
        Actions, or a custom runner — because we want customers who <em>choose</em> us, not customers who are stuck.
      </p>

      <h2>Schedules and sensors</h2>
      <p>
        <strong>Schedules</strong> are time-based (cron). <strong>Sensors</strong> react to events (files, webhooks,
        upstream completions). Both belong in the orchestration layer, not embedded as opaque strings inside EL
        connectors.
      </p>

      <h2>Partitions</h2>
      <p>
        For backfills and incremental windows, runs can carry a partition key. Generated Python templates reserve a{" "}
        <code>partition_key</code> path for that pattern.
      </p>

      <h2>Where it appears in the product</h2>
      <ul>
        <li>
          <Link href="/builder">Pipelines</Link> — definitions and exports.
        </li>
        <li>
          <code>datapulse_workspace.yaml</code> — <code>scheduling</code> and resilience metadata next to generated code.
        </li>
        <li>
          <Link href="/runs">Runs</Link> (signed in) — execution history reported by your runner or CI.
        </li>
      </ul>

      <h2>Roadmap</h2>
      <p>
        First-class schedule and sensor experiences in the product, deeper native orchestration, and ongoing
        interoperability with external engines are tracked on the <Link href="/roadmap">roadmap</Link>.
      </p>
    </DocsProse>
  );
}
