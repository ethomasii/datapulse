import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "dbt transformations",
  description: "Enable post-load dbt in eltPulse pipelines via the dlt dbt runner.",
};

export default function DbtDocsPage() {
  return (
    <DocsProse>
      <h1>dbt transformations</h1>
      <p>
        eltPulse supports <strong>post-load dbt</strong> on dlt pipelines using{" "}
        <a href="https://dlthub.com/docs/dlt-ecosystem/transformations/dbt" target="_blank" rel="noreferrer">
          dlt&apos;s dbt runner
        </a>
        . After extract/load completes, generated pipeline code can run models from your dbt project (local path or git
        URL).
      </p>

      <h2>Enable in the builder</h2>
      <ol>
        <li>Open a <strong>dlt</strong> pipeline in the <Link href="/builder">builder</Link>.</li>
        <li>Under post-transform, choose <strong>dbt (post-load dbt run)</strong>.</li>
        <li>
          Set <code>package_path</code> to your dbt project directory or repository URL, plus optional dataset name,
          branch, and model selector.
        </li>
        <li>Save — codegen appends a dbt step after <code>pipeline.run()</code>.</li>
      </ol>

      <h2>Configuration shape</h2>
      <p>Settings are stored on the pipeline as <code>sourceConfiguration.dlt_dbt</code>:</p>
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
        When you run with a partition key, dlt passes slice context into dbt via <code>additional_vars</code>. Default
        var names are <code>elt_partition_value</code> and <code>elt_partition_column</code> — override with{" "}
        <code>slice_value_var</code> and <code>slice_column_var</code> to match existing models that call{" "}
        <code>var(&apos;my_slice&apos;)</code>.
      </p>

      <h2>dlt-hub staging packages</h2>
      <p>
        Verified sources often have community dbt packages on the dbt Hub (e.g. <code>dlt-hub/stripe_source</code>). See
        the <Link href="/dbt">dbt overview</Link> for a source → package table, or browse{" "}
        <Link href="/connectors">connectors</Link>.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>Host dbt Cloud, the dbt IDE, or semantic-layer authoring.</li>
        <li>Auto-generate a full mart layer for every connector — you bring or add dbt packages.</li>
        <li>Run dbt on Sling-only database replication pipelines (dbt hook is on the dlt codegen path).</li>
      </ul>

      <p>
        <Link href="/dbt">Marketing overview</Link> · <Link href="/docs/pipelines">Pipelines</Link> ·{" "}
        <Link href="/compare">Compare vendors</Link>
      </p>
    </DocsProse>
  );
}
