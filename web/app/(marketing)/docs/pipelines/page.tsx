import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { getSourceCount } from "@/lib/marketing/connector-catalog";

const sourceCount = getSourceCount();

export const metadata: Metadata = {
  title: "Pipelines",
  description:
    "Visual ELT canvas, sources, destinations, generated dlt/Sling/dbt code, and GitOps declarations.",
};

export default function PipelinesDocsPage() {
  return (
    <DocsProse>
      <h1>Pipelines</h1>
      <p>
        A <strong>pipeline</strong> is a named definition from a <strong>source type</strong> to a{" "}
        <strong>destination type</strong>. eltPulse resolves the sync engine automatically — <strong>dlt</strong> for
        SaaS/API sources, <strong>Sling</strong> for database replication — and generates code you can run managed or
        export to Git.
      </p>

      <h2>Connector catalog</h2>
      <p>
        The builder exposes {sourceCount}+ sources and major warehouse destinations. Tier-1 connectors (GitHub, HubSpot,
        Salesforce, Stripe, Postgres, and more) ship with production codegen, credential forms, and{" "}
        <Link href="/docs/run-slices">run slice</Link> wiring where applicable. Browse the public{" "}
        <Link href="/connectors">connector catalog</Link> for trust tier, sync mode, and scenario recipes.
      </p>

      <h2>Visual canvas</h2>
      <p>
        The <Link href="/builder?view=canvas">visual canvas</Link> is eltPulse&apos;s drag-and-drop pipeline designer — the
        same pipeline as the form builder, optimized for graph editing:
      </p>
      <ul>
        <li>
          <strong>Node graph</strong> — stored in <code>sourceConfiguration.canvas</code>; source, transform, and
          destination nodes with typed edges.
        </li>
        <li>
          <strong>Transform inspector</strong> — dbt, <code>dlt_dbt</code>, and <code>post_transform</code> sync back
          into source config on save; includes the workspace dbt project picker.
        </li>
        <li>
          <strong>Pulse AI integration</strong> — AI can add nodes, wire edges, and patch configs from chat (see{" "}
          <Link href="/docs/ai-builder">Pulse AI</Link>).
        </li>
        <li>
          <strong>Any warehouse</strong> — Snowflake, BigQuery, Redshift, MotherDuck, Postgres, DuckDB, Databricks as
          destinations on one graph.
        </li>
      </ul>

      <h2>Form builder &amp; Quick start</h2>
      <p>
        The tabbed builder supports catalog wizard, manual JSON, and Pulse AI create flows.{" "}
        <Link href="/quick-start">Quick start</Link> is the fastest path: destination → source → credentials → run on
        managed workers.
      </p>

      <h2>Artifacts</h2>
      <ul>
        <li>
          <strong>Sync runner</strong> — generated Python (dlt) or <code>replication.yaml</code> (Sling).
        </li>
        <li>
          <strong>config.yaml</strong> — serialized source/destination configuration. Link saved{" "}
          <Link href="/connections">connections</Link> (<code>sourceConnectionId</code> /{" "}
          <code>destinationConnectionId</code>); generated YAML may include resolved connection names.
        </li>
        <li>
          <strong>eltpulse_workspace.yaml</strong> — scheduling, retries, and code location metadata. See{" "}
          <Link href="/docs/orchestration">Orchestration</Link>.
        </li>
      </ul>

      <h2>Declarative YAML (GitOps)</h2>
      <p>
        Define or update pipelines without the UI via <code>POST /api/elt/pipelines/declaration</code>. The document
        must include <code>eltpulse_pipeline_declaration: 1</code> and the same fields as{" "}
        <code>POST /api/elt/pipelines</code> (name, source/destination types, <code>sourceConfiguration</code>, optional
        dbt, <code>dbtProjectId</code>, <code>_partitionConfig</code>, execution settings).
      </p>
      <ul>
        <li>
          <strong>Upsert:</strong> <code>upsert: true</code> or <code>?mode=upsert</code> for idempotent GitHub Actions
          applies.
        </li>
        <li>
          <strong>Content-Type:</strong> raw YAML or JSON <code>{`{ "declaration": "..." }`}</code>.
        </li>
        <li>
          Example: <code className="text-sm">examples/eltpulse-pipeline.declaration.example.yaml</code>.
        </li>
      </ul>

      <h2>Runs on (execution targeting)</h2>
      <p>
        Each pipeline has <strong>Runs on</strong>: Inherit (account default), eltPulse-managed, or Customer gateway.
        Set a <strong>default gateway</strong> token to route new runs to a named connector. Resolution order and
        monitor behavior are documented in <Link href="/docs/concepts">Concepts</Link>; gateway deployment in{" "}
        <Link href="/docs/gateway">Gateway</Link>.
      </p>

      <h2>Edit and delete</h2>
      <p>
        <strong>Edit</strong> regenerates all artifacts on save (and may auto-push to GitHub). Delete removes the
        pipeline from workspace storage.
      </p>

      <p>
        <Link href="/builder">Open Pipelines</Link> · <Link href="/builder?view=canvas">Open canvas</Link> ·{" "}
        <Link href="/docs/concepts">Concepts</Link> · <Link href="/docs/repositories">Repositories</Link>
      </p>
    </DocsProse>
  );
}
