import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const sourceCount = getSourceCount();

export const metadata: Metadata = {
  title: "Connectors",
  description: `How eltPulse sources and destinations work — ${sourceCount}+ connectors, dlt & Sling engines, run slices.`,
};

export default function ConnectorsDocsPage() {
  return (
    <DocsProse>
      <h1>Connectors</h1>
      <p>
        eltPulse exposes a unified catalog of {sourceCount}+ ingestion sources and warehouse destinations. The product
        picks the right sync engine, scaffolds production-ready pipeline code, and labels slice capability honestly — you
        run on managed workers or export to Git.
      </p>

      <h2>Browse the catalog</h2>
      <p>
        The public <Link href="/connectors">connector catalog</Link> lists every source and destination with trust tier,
        sync mode, and links to curated <Link href="/scenarios">pipeline scenarios</Link>. Counts stay in sync with the
        in-app builder.
      </p>

      <h2>Sync engines</h2>
      <ul>
        <li>
          <strong>dlt</strong> — SaaS and API sources (GitHub, HubSpot, Salesforce, Stripe, etc.). Incremental cursors
          and env-bound slice windows in generated Python.
        </li>
        <li>
          <strong>Sling</strong> — database replication (Postgres, MySQL, SQL Server, Oracle, …) with high-throughput
          table sync and <code>update_key</code> incremental mode.
        </li>
        <li>
          <strong>Destinations</strong> — Snowflake, BigQuery, Redshift, MotherDuck, Postgres, DuckDB, Databricks, and
          more receive loads from both engines.
        </li>
      </ul>

      <h2>Trust tiers</h2>
      <ul>
        <li>
          <strong>Verified</strong> — first-class connectors with codegen, credential fields, incremental defaults, and
          run-slice wiring where the upstream API supports it (e.g. GitHub, HubSpot, Salesforce, Personio, Matomo).
        </li>
        <li>
          <strong>Beta</strong> — supported with connection forms; may need more manual tuning in generated code.
        </li>
        <li>
          <strong>Catalog</strong> — available in the builder combobox and Pulse AI; scaffold via REST API context or
          free-text configuration.
        </li>
      </ul>

      <h2>Run slices (Fivetran-style backfills)</h2>
      <p>
        Tier-1 connectors are held to an integration quality bar: either <strong>date/key slices work</strong> in
        generated code, or the UI shows <strong>full replace only</strong> / <strong>not wired</strong> honestly. Configure
        per pipeline on <Link href="/run-slices">Run slices</Link>; full guide at{" "}
        <Link href="/docs/run-slices">Run slices (docs)</Link>.
      </p>

      <h2>Sync modes</h2>
      <p>
        <strong>Connector sync</strong> — API, file, and SaaS sources via REST or native APIs.{" "}
        <strong>Database replication</strong> — table-level incremental with primary keys. Warehouses are destinations
        for both.
      </p>

      <h2>In the app</h2>
      <ul>
        <li>
          <Link href="/quick-start">Quick start</Link> — destination → source → credentials → run.
        </li>
        <li>
          <Link href="/connections">Connections</Link> — encrypted secrets reused across pipelines.
        </li>
        <li>
          <Link href="/builder">Builder</Link> — catalog wizard, canvas, and Pulse AI-assisted scaffolding.
        </li>
        <li>
          <Link href="/assets">Assets</Link> — config-derived map of landing tables and transform outputs.
        </li>
      </ul>

      <p>
        <Link href="/connectors">Connector catalog</Link> · <Link href="/scenarios">Scenarios</Link> ·{" "}
        <Link href="/docs/pipelines">Pipelines</Link> · <Link href="/compare">Compare</Link>
      </p>
    </DocsProse>
  );
}
