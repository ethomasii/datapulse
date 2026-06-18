import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "AI Builder",
  description:
    "Describe pipelines in natural language — eltPulse generates source config, post-load dbt, and save-ready payloads.",
};

export default function AiBuilderDocsPage() {
  return (
    <DocsProse>
      <h1>AI Builder</h1>
      <p>
        The <strong>AI Builder</strong> (Claude-powered) lives in the{" "}
        <Link href="/builder">pipeline builder</Link> create flow and as a floating widget on other app pages. Describe
        what you want to load — source, destination, optional dbt transform — and it generates a save-ready pipeline
        definition with inline credential fields where needed.
      </p>

      <h2>Who can use it</h2>
      <p>
        Only workspace roles with <strong>pipeline write</strong> (owners, solo users, and <strong>member</strong>{" "}
        invites) can save AI-generated pipelines. Viewers, catalog editors, and catalog browsers get a read-only message;
        they can still browse catalog docs and assets but not persist new pipelines.
      </p>

      <h2>What it generates</h2>
      <ul>
        <li>
          <strong>Core pipeline</strong> — name, source type, destination type, connector-specific{" "}
          <code>sourceConfiguration</code>, and generated Python/YAML preview.
        </li>
        <li>
          <strong>Post-load dbt (EL+T)</strong> — when you ask for transforms after load, the AI sets{" "}
          <code>sourceConfiguration.dbt</code> with <code>package_path</code>, optional Git URL, schema, branch, and
          model selector — same shape as the form builder and canvas transform inspector.
        </li>
        <li>
          <strong>Linked dbt project</strong> — the AI can call <code>list_dbt_projects</code> and set{" "}
          <code>dbtProjectId</code> on the save payload to link a workspace project from{" "}
          <Link href="/catalog/dbt">/catalog/dbt</Link> (equivalent to the dbt project picker in builder/canvas).
        </li>
        <li>
          <strong>Python / SQL post-transform</strong> — optional <code>post_transform</code> block for scripts after
          load.
        </li>
      </ul>

      <h2>Human-in-the-loop save</h2>
      <ol>
        <li>Review the generated code preview in the chat.</li>
        <li>Click <strong>Looks good</strong> to reveal save options.</li>
        <li>Fill inline fields (e.g. GitHub org/repo) or skip and edit in the form builder.</li>
        <li>After save, open the pipeline in the <strong>form builder</strong> or <strong>visual canvas</strong>.</li>
      </ol>

      <h2>Example prompts</h2>
      <ul>
        <li>Load GitHub issues and PRs into Snowflake</li>
        <li>Sync Stripe payments to BigQuery with dbt staging</li>
        <li>GitHub → Snowflake EL+T with dbt models after load</li>
        <li>What workspace dbt projects do I have?</li>
      </ul>

      <h2>API</h2>
      <p>
        <code>POST /api/elt/ai-assistant</code> accepts <code>{`{ messages: [{ role, content }] }`}</code> and returns{" "}
        <code>message</code>, optional <code>savePayload</code> (same as <code>POST /api/elt/pipelines</code>),{" "}
        <code>requiredFields</code>, and <code>codePreview</code>. Requires session auth and{" "}
        <code>canWrite</code> permission.
      </p>

      <p>
        <Link href="/docs/pipelines">Pipelines</Link> · <Link href="/docs/dbt">dbt transforms</Link> ·{" "}
        <Link href="/docs/catalog">Catalog</Link>
      </p>
    </DocsProse>
  );
}
