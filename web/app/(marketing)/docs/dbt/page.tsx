import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "dbt transformations",
  description:
    "Standalone workspace dbt projects, post-load EL+T in pipelines, and canvas/builder configuration.",
};

export default function DbtDocsPage() {
  return (
    <DocsProse>
      <h1>dbt transformations</h1>
      <p>
        eltPulse supports dbt in two ways: <strong>first-class workspace projects</strong> (like Snowflake dbt Projects
        or dbt Cloud) and <strong>in-pipeline post-load runs</strong> after connector sync completes.
      </p>

      <h2>Workspace dbt projects</h2>
      <p>
        Register Git-backed or local-path projects at <Link href="/catalog/dbt">/catalog/dbt</Link>. Each{" "}
        <code>DbtProject</code> row stores package path, Git URL/branch, target schema, run scope, schedule, and optional
        warehouse connection. You can:
      </p>
      <ul>
        <li>Run dbt standalone (runs without a pipeline id).</li>
        <li>Link one project to one or more pipelines for shared EL+T config.</li>
        <li>Scaffold from the Transform hub or connector staging packages.</li>
      </ul>

      <h2>Enable in the builder or canvas</h2>
      <ol>
        <li>
          Open a pipeline in the <Link href="/builder">form builder</Link> or{" "}
          <Link href="/builder/canvas">visual canvas</Link> (connector sync pipelines support in-pipeline dbt).
        </li>
        <li>
          Under post-transform (builder) or the transform node inspector (canvas), choose <strong>dbt</strong>.
        </li>
        <li>
          Use the <strong>workspace dbt project picker</strong> to link a registered project, or configure inline (
          <code>package_path</code>, schema, branch, selector).
        </li>
        <li>
          Save — the pipeline stores <code>dbtProjectId</code> when linked; config merges into{" "}
          <code>sourceConfiguration.dbt</code> for codegen.
        </li>
      </ol>

      <h2>AI Builder</h2>
      <p>
        The <Link href="/docs/ai-builder">AI Builder</Link> can generate EL+T pipelines with{" "}
        <code>post_transform_type=dbt</code>, list existing workspace projects, and set <code>dbtProjectId</code> on the
        save payload. See <Link href="/docs/ai-builder">AI Builder docs</Link>.
      </p>

      <h2>Configuration shape</h2>
      <p>Transform settings persist on the pipeline under <code>sourceConfiguration.dbt</code> (legacy key: <code>dlt_dbt</code>):</p>
      <pre>{`{
  "enabled": true,
  "project_id": "clx…",
  "package_path": "https://github.com/org/dbt-analytics.git",
  "dataset_name": "analytics",
  "repository_branch": "main",
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
        from the <Link href="/connectors">connector catalog</Link>.
      </p>

      <h2>Permissions</h2>
      <p>
        Creating, editing, linking, and running dbt projects requires <strong>member</strong> (pipeline write). Catalog
        editors and viewers may browse project detail pages but cannot save or trigger runs. See{" "}
        <Link href="/docs/catalog">Catalog &amp; RBAC</Link>.
      </p>

      <h2>What we don&apos;t do</h2>
      <ul>
        <li>Host dbt Cloud, the dbt IDE, or semantic-layer authoring.</li>
        <li>Auto-generate a full mart layer for every connector — you bring or add dbt packages.</li>
        <li>
          Run dbt inside database-replication-only pipelines — use a connector sync pipeline or run dbt separately in
          CI for pure replication workloads.
        </li>
      </ul>

      <p>
        <Link href="/catalog/dbt">dbt projects (app)</Link> · <Link href="/docs/pipelines">Pipelines</Link> ·{" "}
        <Link href="/docs/ai-builder">AI Builder</Link>
      </p>
    </DocsProse>
  );
}
