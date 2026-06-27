import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const sourceCount = getSourceCount();

export const metadata: Metadata = {
  title: "Run slices",
  description:
    "Partition backfills and incremental windows — Fivetran-style date slices on dlt, Sling, and verified connectors.",
};

export default function RunSlicesDocsPage() {
  return (
    <DocsProse>
      <h1>Run slices</h1>
      <p>
        <strong>Run slices</strong> let you scope a pipeline run to a date or key window — the same operational pattern
        Fivetran and Airbyte use for backfills, without giving up ownership of generated code. In eltPulse, a slice value
        is passed as <code>partition_key</code> into generated dlt or Sling pipelines.
      </p>

      <h2>When to use slices</h2>
      <ul>
        <li>
          <strong>Backfill</strong> — replay historical days or tenant keys after a schema change or outage.
        </li>
        <li>
          <strong>Bounded incremental</strong> — run one day at a time for large SaaS sources instead of one giant sync.
        </li>
        <li>
          <strong>Monitor triggers</strong> — eltPulse monitors can queue one run per slice value when a file lands or a
          schedule fires (see <Link href="/docs/orchestration">Orchestration</Link>).
        </li>
      </ul>

      <h2>Configure in the app</h2>
      <ol>
        <li>
          Open <Link href="/run-slices">Run slices</Link> in the sidebar (or from a pipeline row).
        </li>
        <li>
          Pick a pipeline and set the <strong>partition column</strong> (e.g. <code>date</code>,{" "}
          <code>updated_at</code>) and strategy.
        </li>
        <li>
          When you start a run, pass a slice value — or let monitors supply <code>partition_values</code> per trigger.
        </li>
      </ol>
      <p>
        The builder and run-slices page show a <strong>capability badge</strong> per source: date/key slice wired, full
        replace only, or not yet wired. Tier-1 connectors in the catalog are held to a high bar — either honest slice
        support or an explicit &quot;full replace only&quot; label.
      </p>

      <h2>How codegen uses partition_key</h2>
      <p>
        eltPulse picks the right mechanism per connector family:
      </p>
      <ul>
        <li>
          <strong>dlt SaaS</strong> — <code>start_date</code>, <code>since</code>, or env-bound incremental cursors
          (e.g. HubSpot, Salesforce, Personio).
        </li>
        <li>
          <strong>Sling database replication</strong> — <code>update_key</code> + incremental mode on the stream.
        </li>
        <li>
          <strong>Filesystem / S3</strong> — path prefix filters for Hive-style layouts.
        </li>
        <li>
          <strong>REST API</strong> — query params such as <code>since</code> or <code>cursor</code>.
        </li>
      </ul>
      <p>
        Verified sources with production slice wiring are tracked in codegen; the UI reads the same registry so labels stay
        in sync with generated Python.
      </p>

      <h2>Declarative YAML and API</h2>
      <p>
        Pipeline declarations accept <code>_partitionConfig</code> in <code>sourceConfiguration</code> — same shape as
        the run-slices editor. See <Link href="/docs/pipelines">Pipelines</Link> for{" "}
        <code>POST /api/elt/pipelines/declaration</code>.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/docs/connectors">Connectors</Link> — trust tiers and which sources support slices today.
        </li>
        <li>
          <Link href="/docs/runs">Runs</Link> — telemetry and logs per slice run.
        </li>
        <li>
          <Link href="/connectors">Connector catalog</Link> — browse {sourceCount}+ sources with sync mode labels.
        </li>
      </ul>
    </DocsProse>
  );
}
