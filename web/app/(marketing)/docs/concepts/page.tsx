import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";
import {
  ArchitectureEgressDiagram,
  EntityRelationshipDiagram,
} from "@/components/docs/diagrams/eltpulse-concepts-diagrams";

export const metadata: Metadata = {
  title: "Concepts",
  description:
    "How pipelines, runs, connections, monitors, and gateways relate — and how to route work to a specific gateway.",
};

export default function ConceptsDocsPage() {
  return (
    <DocsProse>
      <h1>Concepts: how the pieces fit</h1>
      <p>
        eltPulse splits <strong>definitions</strong> (what to run) from <strong>execution</strong> (who runs it).
        This page maps the main objects and how you steer pipelines and monitors toward eltPulse-managed compute vs a
        specific <Link href="/docs/gateway">gateway</Link>.
      </p>

      <h2>Diagrams</h2>
      <p>
        The first figure is an <strong>entity relationship</strong> view (what references what in the product). The
        second is <strong>architecture</strong>: what runs in eltPulse-hosted environments versus your network, and what
        crosses the <strong>egress-only</strong> link (HTTPS + JSON control APIs — not your warehouse bulk traffic).
      </p>
      <EntityRelationshipDiagram />
      <ArchitectureEgressDiagram />

      <h2>Core objects</h2>
      <dl className="space-y-4 not-prose text-sm">
        <div>
          <dt className="font-semibold text-slate-900 dark:text-white">Pipeline</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            A named definition (source → destination, generated code, workspace YAML). Stored per user. Optional{" "}
            <strong>source</strong> and <strong>destination</strong> links are stored as foreign keys (
            <code>sourceConnectionId</code>, <code>destinationConnectionId</code>) to rows on the Connections page. When
            set, generated <code>config.yaml</code> may include the connection <strong>names</strong> for runners that
            still read <code>source_connection</code> / <code>destination_connection</code> — those keys are derived
            from the linked row, not authored as the source of truth in JSON. See{" "}
            <Link href="/docs/pipelines" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Pipelines
            </Link>{" "}
            and <Link href="/connections" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Connections
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-white">Run</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            One execution of a pipeline: status, <strong>structured logs</strong> (<code>logEntries</code>),{" "}
            <strong>telemetry</strong> (rows, bytes, progress samples), timestamps, <code>triggeredBy</code> (schedule,
            monitor, webhook, API). Many runs can exist per pipeline over time. View them on{" "}
            <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Runs
            </Link>
            ; see <Link href="/docs/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Runs (docs)
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-white">Connection</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            A saved <strong>profile</strong> for a source or destination: connector type, non-secret <code>config</code>
            , and optionally encrypted secrets. <strong>Pipelines</strong> link optional source/destination profiles by
            id (builder / API). <strong>Monitors</strong> pick a connection in the monitor UI, which stores a database{" "}
            <code>connectionId</code> on the monitor row. Gateways can load all
            profiles (with decrypted secrets) via <code>GET /api/agent/connections</code>. Manage profiles on{" "}
            <Link href="/connections" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Connections
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-white">Monitor (sensor)</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            Watches an external signal (e.g. S3 object count) and can enqueue a <strong>run</strong> of a named pipeline
            when a threshold is met. Optional link to a <strong>connection</strong> for credentials. Configure on{" "}
            <Link href="/orchestration" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Monitors
            </Link>
            .
          </dd>
        </div>
        <div>
          <dt className="font-semibold text-slate-900 dark:text-white">Gateway (named token)</dt>
          <dd className="mt-1 text-slate-600 dark:text-slate-400">
            A <strong>named connector</strong> you create on the{" "}
            <Link href="/gateway" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
              Gateway
            </Link>{" "}
            page: one row in <code>AgentToken</code> with its own Bearer secret. Your process uses that secret on{" "}
            <code>/api/agent/*</code>. Org-scoped tokens belong to a workspace; personal tokens belong to your user.
          </dd>
        </div>
      </dl>

      <h2>Relationships (quick)</h2>
      <ul>
        <li>
          <strong>Pipeline → runs:</strong> triggers (schedule, monitor, webhook, API) create <strong>runs</strong>{" "}
          pointing at that pipeline&apos;s <code>pipelineId</code>.
        </li>
        <li>
          <strong>Pipeline → connection:</strong> optional foreign keys <code>sourceConnectionId</code> /{" "}
          <code>destinationConnectionId</code> to saved profiles (same idea as <code>connectionId</code> on monitors).
          Exported YAML may still surface resolved names for runners.
        </li>
        <li>
          <strong>Monitor → pipeline:</strong> each monitor names a <code>pipelineName</code> (must match an existing
          pipeline). It does not embed pipeline code.
        </li>
        <li>
          <strong>Monitor → connection:</strong> cloud monitor types store a <strong>foreign key</strong> to a
          connection so checks use that profile&apos;s connector and secrets (e.g. S3 connector for an S3 file-count
          monitor).
        </li>
        <li>
          <strong>Gateway → connections:</strong> a process using a gateway token may call{" "}
          <code>GET /api/agent/connections</code> and receive decrypted secret keys for that user&apos;s connections (use
          only in trusted runtime). See <Link href="/docs/security">Security &amp; data</Link>.
        </li>
        <li>
          <strong>Pipeline definition vs runner env:</strong> even when a pipeline links a saved connection, many runners
          still expect secrets as <strong>environment variables</strong> where ingestion executes (CI, gateway host, or
          managed worker), while the Connections page documents which keys to set. If the gateway loads secrets via{" "}
          <code>GET /api/agent/connections</code>, it can align with the same profile for agent-driven flows.
        </li>
      </ul>

      <h2>Account execution plane</h2>
      <p>
        Your user (or org context) has an <strong>execution plane</strong> setting: <strong>eltPulse-managed</strong>{" "}
        vs <strong>your infrastructure</strong> (customer). It affects the default when objects use{" "}
        <strong>inherit</strong> — it does not delete pipelines; it changes where new runs are expected to execute when
        <code>Runs on</code> is set to inherit. Switch it on <Link href="/gateway">Gateway</Link>.
      </p>

      <h2>Pipelines: where new runs execute</h2>
      <p>Each pipeline has <strong>Runs on</strong> (<code>executionHost</code>):</p>
      <ul>
        <li>
          <strong>Inherit</strong> — follow account execution plane: managed plane → eltPulse-managed workers; customer
          plane → customer gateway path (see resolution below).
        </li>
        <li>
          <strong>eltPulse-managed</strong> — force new runs to eltPulse-operated execution (telemetry still in Neon).
        </li>
        <li>
          <strong>Customer gateway</strong> — force customer path: runs get a <code>targetAgentTokenId</code> from your
          defaults unless overridden per run.
        </li>
      </ul>
      <p>
        In the <Link href="/builder">builder</Link>, you can also set the pipeline&apos;s{" "}
        <strong>default gateway</strong> (named token). That pins <em>new</em> runs to that connector when the run
        doesn&apos;t specify another target and the resolver needs a gateway.
      </p>

      <h3>Who picks <code>targetAgentTokenId</code> on a new run?</h3>
      <p>For customer-gateway paths, the control plane resolves in order:</p>
      <ol>
        <li>
          <strong>Explicit per run</strong> — if the API body includes <code>targetAgentTokenId</code> (named token id),
          that gateway (if you own it) wins. Use <code>null</code> to mean &quot;any gateway&quot; with this user&apos;s
          token (untargeted).
        </li>
        <li>
          <strong>Pipeline default</strong> — the pipeline&apos;s default gateway, if set and still valid.
        </li>
        <li>
          <strong>Org default</strong> — when working in an org context, the organization&apos;s default gateway token.
        </li>
        <li>
          <strong>Account default</strong> — your user&apos;s default gateway on the Gateway page.
        </li>
        <li>
          <strong>Single token in scope</strong> — if you have exactly one personal or org-scoped named token in that
          context, it may auto-pin unrouted runs.
        </li>
      </ol>
      <p>
        A named gateway polling with its Bearer token only receives runs where <code>targetAgentTokenId</code> is{" "}
        <strong>null</strong> (any gateway) or <strong>equals that token&apos;s id</strong>. Another named gateway
        cannot claim a run targeted at a different token.
      </p>

      <h2>Monitors: where checks run</h2>
      <p>
        Each monitor has its own <strong>Runs on</strong> (<code>execution_host</code> in the API): <strong>inherit</strong>
        , <strong>eltPulse-managed</strong>, or <strong>customer gateway</strong>, with the same meaning as pipelines
        relative to your account execution plane.
      </p>
      <ul>
        <li>
          <strong>eltPulse-managed</strong> — eltPulse&apos;s cloud cron evaluates the monitor (S3/SQS today); your
          gateway must not POST results for it.
        </li>
        <li>
          <strong>Customer gateway</strong> — only your gateway should evaluate and call{" "}
          <code>POST /api/agent/monitors/:id/report</code>.
        </li>
        <li>
          <strong>Inherit + customer plane</strong> — checks run on the gateway; <strong>inherit + managed plane</strong>{" "}
          — checks run in eltPulse cron.
        </li>
      </ul>
      <p>
        Monitors reuse the same <strong>connections</strong> as the rest of the app so credentials stay in one place.
      </p>

      <h2>Schedules</h2>
      <p>
        Cron / interval definitions live in workspace YAML and the <Link href="/schedule">Schedule</Link> experience.
        When a schedule fires, it creates a run; that run still follows the pipeline&apos;s <strong>Runs on</strong> and
        gateway resolution above.
      </p>

      <h2>Related guides</h2>
      <ul>
        <li>
          <Link href="/docs/gateway">Gateway</Link> — env vars, <code>/api/agent/*</code>, Docker image.
        </li>
        <li>
          <Link href="/docs/orchestration">Orchestration</Link> — schedules and monitors in product terms.
        </li>
        <li>
          <Link href="/docs/pipelines">Pipelines</Link> — artifacts and builder.
        </li>
        <li>
          <Link href="/docs/security">Security &amp; data</Link> — auth, encryption, what leaves the control plane.
        </li>
      </ul>
    </DocsProse>
  );
}
