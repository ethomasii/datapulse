import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "dbt transformations",
  description: "Enable post-load dbt in eltPulse pipelines — models run automatically after data lands in your warehouse.",
};

export default function DbtDocsPage() {
  return (
    <DocsProse>
      <h1>dbt transformations</h1>
      <p>
        eltPulse can run <strong>dbt after every sync</strong>. Once extract and load finish, the pipeline executes
        models from your dbt project (local path or git URL) against the same destination you configured in the builder.
      </p>

      <h2>Enable in the builder</h2>
      <ol>
        <li>Open a pipeline in the <Link href="/builder">builder</Link> (API and SaaS connectors support in-pipeline dbt).</li>
        <li>Under post-transform, choose <strong>dbt (post-load dbt run)</strong>.</li>
        <li>
          Set <code>package_path</code> to your dbt project directory or repository URL, plus optional dataset name,
          branch, and model selector.
        </li>
        <li>Save — eltPulse exports pipeline code that runs dbt after the load step.</li>
      </ol>

      <h2>Configuration shape</h2>
      <p>Transform settings are persisted on the pipeline under <code>sourceConfiguration.dbt</code>:</p>
      <pre>{`{
  "enabled": true,
  "package_path": "./dbt",
  "dataset_name": "analytics",
  "package_repository_branch": "main",
  "run_scope": "all",
  "selector": "tag:nightly",
  "slice_value_var": "elt_partition_value",
  "slice_column_var": "elt_partition_column"
}`}</pre>

      <h2>Partitioned / sliced runs</h2>
      <p>
        When you run with a partition key, eltPulse passes slice context into dbt as vars. Default names are{" "}
        <code>elt_partition_value</code> and <code>elt_partition_column</code> — override with{" "}
        <code>slice_value_var</code> and <code>slice_column_var</code> to match existing models that call{" "}
        <code>var(&apos;my_slice&apos;)</code>.
      </p>

      <h2>Connector staging packages</h2>
      <p>
        Many verified connectors have community staging packages on the dbt Hub (e.g.{" "}
        <code>stripe_source</code>). See the <Link href="/dbt">transform hub</Link> to browse by connector, or start
        start from the <Link href="/connectors">connector catalog</Link>.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>Host dbt Cloud, the dbt IDE, or semantic-layer authoring.</li>
        <li>Auto-generate a full mart layer for every connector — you bring or add dbt packages.</li>
        <li>
          Run dbt inside database-replication-only pipelines today — use a connector sync pipeline or run dbt separately
          in CI for pure replication workloads.
        </li>
      </ul>

      <p>
        <Link href="/dbt">Transform hub</Link> · <Link href="/docs/pipelines">Pipelines</Link> ·{" "}
        <Link href="/compare">Compare vendors</Link>
      </p>
    </DocsProse>
  );
}
