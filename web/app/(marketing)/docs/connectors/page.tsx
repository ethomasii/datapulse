import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const sourceCount = getSourceCount();

export const metadata: Metadata = {
  title: "Connectors",
  description: `How eltPulse sources and destinations work — ${sourceCount}+ connectors, verified vs catalog, sync modes.`,
};

export default function ConnectorsDocsPage() {
  return (
    <DocsProse>
      <h1>Connectors</h1>
      <p>
        eltPulse exposes a unified catalog of ingestion sources and warehouse destinations. The product picks the right
        sync engine for each connector type, then scaffolds production-ready pipeline code you can run managed or export
        to Git.
      </p>

      <h2>Browse the catalog</h2>
      <p>
        The public{" "}
        <Link href="/connectors">connector catalog</Link> lists every source and destination with trust tier, sync mode,
        and links to curated <Link href="/scenarios">pipeline scenarios</Link>. Counts stay in sync with the in-app
        builder ({sourceCount}+ sources today).
      </p>

      <h2>Trust tiers</h2>
      <ul>
        <li>
          <strong>Verified</strong> — first-class connectors with codegen, credential fields, and incremental defaults
          (e.g. GitHub, Stripe, HubSpot).
        </li>
        <li>
          <strong>Beta</strong> — supported in eltPulse with connection forms; may need more manual config in generated
          code.
        </li>
        <li>
          <strong>Catalog</strong> — available in the builder combobox and AI assistant; scaffold via REST API context
          or free-text configuration.
        </li>
      </ul>

      <h2>Sync modes</h2>
      <p>
        <strong>Connector sync</strong> — API, file, and SaaS sources: extract via REST or native APIs into your
        warehouse. <strong>Database replication</strong> — Postgres, MySQL, SQL Server, Oracle, and similar: high-throughput
        table replication with incremental cursors. Warehouses (Snowflake, BigQuery, Redshift, Databricks) are destinations
        for both modes.
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
          <Link href="/builder">Builder</Link> — full catalog wizard and AI-assisted scaffolding.
        </li>
      </ul>

      <p>
        <Link href="/connectors">Connector catalog</Link> · <Link href="/scenarios">Scenarios</Link> ·{" "}
        <Link href="/docs/pipelines">Pipelines</Link>
      </p>
    </DocsProse>
  );
}
