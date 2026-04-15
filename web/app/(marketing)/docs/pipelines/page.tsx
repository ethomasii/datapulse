import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Pipelines",
  description: "Sources, destinations, tools, and exports in eltPulse.",
};

export default function PipelinesDocsPage() {
  return (
    <DocsProse>
      <h1>Pipelines</h1>
      <p>
        A <strong>pipeline</strong> is a named definition from a <strong>source type</strong> to a{" "}
        <strong>destination type</strong>. eltPulse resolves the right sync engine automatically based on your source
        and destination combination.
      </p>

      <h2>Catalog</h2>
      <p>
        The builder exposes a broad catalog of sources and destinations. Generators are implemented incrementally: GitHub
        and REST are structured in the UI; other sources use a generic template until parity with the original Python
        builder lands.
      </p>

      <h2>Artifacts</h2>
      <ul>
        <li>
          <strong>Sync runner</strong> — the executable artifact eltPulse generates for your pipeline.
        </li>
        <li>
          <strong>config.yaml</strong> — Serialized source/destination configuration for reproducibility. Link saved{" "}
          <Link href="/connections">connections</Link> from the builder (stored as <code>sourceConnectionId</code> /{" "}
          <code>destinationConnectionId</code>); generated YAML may include resolved <code>source_connection</code> /{" "}
          <code>destination_connection</code> names when those links exist (see <Link href="/docs/concepts">Concepts</Link>
          ).
        </li>
        <li>
          <strong>eltpulse_workspace.yaml</strong> — Workspace metadata (scheduling, retries, code location) for your
          repo layout. See <Link href="/docs/orchestration">Orchestration</Link> for how schedules relate to pipeline
          definitions.
        </li>
      </ul>

      <h2>Edit and delete</h2>
      <p>
        Use <strong>Edit</strong> on a row to change definition; we regenerate all artifacts on save. Delete removes the
        row from your workspace storage.
      </p>

      <h2>Where runs execute (Runs on)</h2>
      <p>
        In the builder, each pipeline has <strong>Runs on</strong>: <strong>Inherit</strong> (follow your account
        execution plane), <strong>eltPulse-managed</strong>, or <strong>Customer gateway</strong>. You can also set a{" "}
        <strong>default gateway</strong> (named token) so new runs route to that connector unless a run is created with an
        explicit override.
      </p>
      <p>
        For the full resolution order (per-run override → pipeline default → org default → account default →
        single-token auto-pin) and how monitors use the same ideas, read{" "}
        <Link href="/docs/concepts">Concepts</Link>. For deploying the process that polls runs, see{" "}
        <Link href="/docs/gateway">Gateway</Link>.
      </p>

      <p>
        <Link href="/builder">Open Pipelines</Link> · <Link href="/docs/concepts">Concepts</Link> ·{" "}
        <Link href="/docs/repositories">Repositories layout</Link>
      </p>
    </DocsProse>
  );
}
