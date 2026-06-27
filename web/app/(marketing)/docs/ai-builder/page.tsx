import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import { PULSE_AI_NAME } from "@/lib/brand/pulse-ai";

export const metadata: Metadata = {
  title: PULSE_AI_NAME,
  description:
    "Describe pipelines in natural language — Pulse AI generates config, patches the canvas, and produces save-ready payloads.",
};

export default function AiBuilderDocsPage() {
  return (
    <DocsProse>
      <h1>{PULSE_AI_NAME}</h1>
      <p>
        <strong>{PULSE_AI_NAME}</strong> is eltPulse&apos;s Claude-powered assistant for pipeline design. It lives in
        the <Link href="/builder">pipeline builder</Link> create flow and as a floating widget (plus an inline bar on
        the visual canvas). Describe what you want to load — source, destination, optional dbt transform, run slices —
        and {PULSE_AI_NAME} generates a save-ready definition with inline credential fields where needed.
      </p>
      <p>
        Lakeflow-style visual design with AI-assisted editing — on <strong>any warehouse</strong>, tied to real dlt,
        Sling, and dbt codegen you can export to Git.
      </p>

      <h2>Who can use it</h2>
      <p>
        Workspace roles with <strong>pipeline write</strong> (owners, solo users, and <strong>member</strong> invites)
        can save AI-generated pipelines. Viewers and catalog-only roles get a read-only message.
      </p>

      <h2>What {PULSE_AI_NAME} generates</h2>
      <ul>
        <li>
          <strong>Core pipeline</strong> — name, source type, destination type, connector-specific{" "}
          <code>sourceConfiguration</code>, and Python/YAML preview.
        </li>
        <li>
          <strong>Canvas patches</strong> — when editing on the{" "}
          <Link href="/builder?view=canvas">canvas</Link>, {PULSE_AI_NAME} can add transform nodes, wire edges, and
          update inspector fields — not just greenfield scaffolding.
        </li>
        <li>
          <strong>Post-load dbt (EL+T)</strong> — sets <code>sourceConfiguration.dbt</code> with package path, Git URL,
          schema, branch, and model selector.
        </li>
        <li>
          <strong>Linked dbt project</strong> — calls <code>list_dbt_projects</code> and sets <code>dbtProjectId</code>{" "}
          to link a workspace project from <Link href="/catalog/dbt">/catalog/dbt</Link>.
        </li>
        <li>
          <strong>Python / SQL post-transform</strong> — optional <code>post_transform</code> block for scripts after
          load.
        </li>
        <li>
          <strong>Workspace context</strong> — list pipelines, connections, and catalog assets to answer setup
          questions.
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
        <li>Sync HubSpot contacts to BigQuery with a dbt staging model after load</li>
        <li>Add a dbt transform node between Stripe and Snowflake on the canvas</li>
        <li>Backfill HubSpot with run slices for last 30 days</li>
        <li>What workspace dbt projects do I have?</li>
      </ul>

      <h2>MCP servers</h2>
      <p>
        Register Model Context Protocol servers at <Link href="/mcp-servers">MCP servers</Link> to extend {PULSE_AI_NAME}{" "}
        with custom tools (HTTP or stdio transports).
      </p>

      <h2>API</h2>
      <p>
        <code>POST /api/elt/ai-assistant</code> accepts <code>{`{ messages: [{ role, content }] }`}</code> and returns{" "}
        <code>message</code>, optional <code>savePayload</code>, <code>requiredFields</code>, and{" "}
        <code>codePreview</code>. Requires session auth (or workspace API key where enabled) and write permission.
      </p>

      <p>
        <Link href="/docs/pipelines">Pipelines &amp; canvas</Link> · <Link href="/docs/dbt">dbt transforms</Link> ·{" "}
        <Link href="/docs/catalog">Catalog</Link>
      </p>
    </DocsProse>
  );
}
