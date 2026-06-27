import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Webhooks",
  description:
    "Outgoing run notifications and incoming triggers — integrate eltPulse with Slack, ServicePulse, or your own automation.",
};

export default function WebhooksDocsPage() {
  return (
    <DocsProse>
      <h1>Webhooks</h1>
      <p>
        Webhooks connect eltPulse to the rest of your stack: notify downstream systems when runs finish, or trigger
        pipelines from external events. Configure everything in the app at{" "}
        <Link href="/webhooks">Webhooks</Link>.
      </p>

      <h2>Outgoing (run finished)</h2>
      <p>
        When a run reaches a terminal state (<code>success</code>, <code>failed</code>, or <code>cancelled</code>),
        eltPulse can POST a JSON payload to your URL.
      </p>
      <ul>
        <li>
          <strong>Global webhook</strong> — one URL for all pipelines in the workspace.
        </li>
        <li>
          <strong>Per-pipeline override</strong> — optional URL on each pipeline row; overrides global when set.
        </li>
      </ul>
      <p>
        Payloads include run id, pipeline name, status, timestamps, and optional <code>telemetrySummary</code> (rows,
        bytes, progress) when the runner reported metrics. Receivers like{" "}
        <a href="https://servicepulse.dev" target="_blank" rel="noreferrer">
          ServicePulse
        </a>{" "}
        can filter on <code>source: &quot;eltpulse&quot;</code>.
      </p>
      <p>
        API: <code>GET/PUT /api/elt/runs/webhook</code> (global),{" "}
        <code>PUT /api/elt/pipelines/:id/webhook</code> (per pipeline). Requires session auth or a workspace API key.
      </p>

      <h2>Incoming (trigger a run)</h2>
      <p>
        Generate a workspace <strong>incoming webhook token</strong> on the Webhooks page. External systems call:
      </p>
      <pre className="not-prose overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-100">
        {`POST /api/webhooks/trigger/:token
Content-Type: application/json

{ "pipelineId": "<uuid>", "partitionValue": "2024-01-15" }`}
      </pre>
      <p>
        Optional <code>partitionValue</code> scopes the run to a slice (see{" "}
        <Link href="/docs/run-slices">Run slices</Link>). Regenerate the token anytime — old tokens stop working
        immediately.
      </p>

      <h2>Pipeline chains</h2>
      <p>
        For downstream work after a successful run, you can also use{" "}
        <Link href="/workflows">Pipeline chains</Link> — native DAG edges between pipelines without writing webhook
        glue. Webhooks remain the portable option for tools outside eltPulse.
      </p>

      <p>
        <Link href="/docs/runs">Runs</Link> · <Link href="/docs/orchestration">Orchestration</Link> ·{" "}
        <Link href="/docs/integrations">Integrations</Link>
      </p>
    </DocsProse>
  );
}
