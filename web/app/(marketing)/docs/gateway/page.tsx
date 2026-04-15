import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Gateway",
  description:
    "Run eltPulse pipelines and monitors in your infrastructure: tokens, environment variables, HTTP API, and deployment options.",
};

export default function GatewayDocsPage() {
  return (
    <DocsProse>
      <h1>Gateway</h1>
      <p>
        The <strong>gateway</strong> is a long-lived process <em>you</em> run (Docker, Kubernetes, ECS, or a VM). It talks
        to the eltPulse <strong>control plane</strong> only over <strong>outbound HTTPS</strong> using a{" "}
        <strong>Bearer token</strong> from the app. It can poll for pending pipeline runs, pull connection profiles
        (including decrypted secrets for agent use), send heartbeats, patch run status, and evaluate{" "}
        <Link href="/docs/orchestration">monitors</Link> when you choose customer-side placement.
      </p>
      <p>
        You do <strong>not</strong> open inbound firewall rules for eltPulse to reach your network. The gateway only{" "}
        <strong>egresses</strong> to your app URL and to the data sources or warehouses you configure in your jobs.
      </p>

      <h2>Control plane vs gateway</h2>
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 dark:border-slate-700">
            <th className="py-2 pr-4 text-left font-semibold">Piece</th>
            <th className="py-2 text-left font-semibold">Role</th>
          </tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100 dark:border-slate-800">
            <td className="py-2 pr-4 align-top font-medium">eltPulse app</td>
            <td className="py-2 text-slate-600 dark:text-slate-400">
              Auth, pipelines, runs, connection metadata, webhooks. No inbound connections into customer VPCs.
            </td>
          </tr>
          <tr>
            <td className="py-2 pr-4 align-top font-medium">Gateway</td>
            <td className="py-2 text-slate-600 dark:text-slate-400">
              Your process: calls <code>/api/agent/*</code>, executes work (or dispatches to workers), reports back.
            </td>
          </tr>
        </tbody>
      </table>

      <h2>Directing pipelines and monitors to a gateway</h2>
      <p>
        A run is visible to <code>GET /api/agent/runs</code> when the Bearer token belongs to the same user and either
        the run is <strong>untargeted</strong> (<code>targetAgentTokenId</code> is null — any of your gateways may
        claim it) or the run is <strong>targeted</strong> to that named token&apos;s id. Set targeting via the{" "}
        <Link href="/builder">pipeline default gateway</Link>, account/org defaults on <Link href="/gateway">Gateway</Link>
        , or <code>targetAgentTokenId</code> when creating a run through the API. Monitors use <strong>Runs on</strong> per
        monitor; when set to customer gateway (or inherit on a customer execution plane), the process using{" "}
        <em>your</em> token evaluates them and reports via <code>POST /api/agent/monitors/:id/report</code>.
      </p>
      <p>
        Full resolution order, object relationships, and <strong>SVG diagrams</strong> (entity model + egress
        architecture): <Link href="/docs/concepts">Concepts</Link>.
      </p>

      <h2>Set up in the product</h2>
      <ol>
        <li>
          Sign in and open <Link href="/gateway">Gateway</Link> (under your account / workspace).
        </li>
        <li>
          Set your account <strong>execution plane</strong> to <strong>Your infrastructure</strong> when you want
          runs to target gateways instead of eltPulse-managed compute (you can still override per pipeline under{" "}
          <strong>Runs on</strong> in the builder).
        </li>
        <li>
          <strong>Generate a named token</strong> (recommended) or use an org-scoped token on Pro/Team. Copy the token
          once — it is shown only at creation time.
        </li>
        <li>
          Optionally set JSON <strong>metadata</strong> on the token, for example{" "}
          <code>{`{"cloud":"aws","region":"us-east-1"}`}</code> for your own labels. For advanced dispatch you can add{" "}
          <code>pipelineRunIsolation</code> / <code>monitorCheckIsolation</code> (<code>inline</code> or{" "}
          <code>spawn</code>) so the manifest tells a custom gateway to fork ECS/K8s jobs instead of running everything
          in one process.
        </li>
      </ol>

      <h2>Environment variables</h2>
      <p>Every gateway deployment needs at least:</p>
      <ul>
        <li>
          <code>ELTPULSE_AGENT_TOKEN</code> — the Bearer secret from the Gateway page (same name as in Docker samples).
        </li>
        <li>
          <code>ELTPULSE_CONTROL_PLANE_URL</code> — your app base URL, e.g. <code>https://app.eltpulse.dev</code> or your
          self-hosted origin (no trailing slash required).
        </li>
      </ul>
      <p>
        Optional flags depend on the <strong>reference gateway</strong> in this repo (see below): stub run completion,
        monitor polling, spawn commands for isolated workers, etc. Read{" "}
        <code>integrations/gateway/README.md</code> in the source tree for the full list.
      </p>

      <h2>Reference gateway (this repository)</h2>
      <p>
        A minimal Node implementation lives at <code>integrations/gateway/</code> in the{" "}
        <a href="https://github.com/eltpulsehq/integrations" target="_blank" rel="noreferrer">
          eltpulsehq/integrations
        </a>{" "}
        mirror (same layout as this monorepo). It uses the same HTTP contract as any custom agent you build.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
        {`cd integrations/gateway
npm install
export ELTPULSE_AGENT_TOKEN="…"
export ELTPULSE_CONTROL_PLANE_URL="https://your-app.example"
# Optional: stub-complete pending runs (demos only)
# export ELTPULSE_EXECUTE_RUNS=1
node src/index.mjs`}
      </pre>
      <p>
        Published image: <code>ghcr.io/eltpulsehq/gateway:latest</code>. Build locally with the included{" "}
        <code>Dockerfile</code>, or run from source as above.
      </p>
      <pre className="overflow-x-auto rounded-lg bg-slate-950 p-4 text-xs text-slate-200">
        {`docker run --rm \\
  -e ELTPULSE_AGENT_TOKEN \\
  -e ELTPULSE_CONTROL_PLANE_URL=https://your-app.example \\
  ghcr.io/eltpulsehq/gateway:latest`}
      </pre>

      <h2>Where to run it (ECS, Kubernetes, local)</h2>
      <p>
        The same gateway image and token work everywhere; only deployment changes. Sample manifests and Terraform live
        alongside the gateway in the integrations repo under paths such as{" "}
        <code>gateways/docker</code>, <code>gateways/local</code>, and (as they are published) ECS/Kubernetes examples —
        start from{" "}
        <a href="https://github.com/eltpulsehq/integrations/tree/main/gateway" target="_blank" rel="noreferrer">
          gateway/
        </a>{" "}
        and{" "}
        <a href="https://github.com/eltpulsehq/integrations/tree/main/gateways" target="_blank" rel="noreferrer">
          gateways/
        </a>
        .
      </p>
      <p>
        For <strong>production</strong>, treat the long-lived process as a <strong>dispatcher</strong>: keep polling and
        heartbeats in a small service, and start <strong>separate containers or jobs</strong> per pipeline run (or per
        monitor check) so user code cannot take down the poller. The reference gateway supports <code>spawn</code>{" "}
        isolation via env and token metadata; see the README in <code>integrations/gateway</code>.
      </p>

      <h2>HTTP API (Bearer token)</h2>
      <p>Stable routes under your app origin (all require <code>Authorization: Bearer …</code>):</p>
      <ul>
        <li>
          <code>GET /api/agent/manifest</code> — poll intervals, workloads (pipelines, monitors), billing hints,{" "}
          <code>executorHints</code> for named tokens.
        </li>
        <li>
          <code>GET /api/agent/runs</code> — pending (or other) runs with pipeline payload for execution.
        </li>
        <li>
          <code>PATCH /api/agent/runs/:id</code> — report status,{" "}
          <Link href="/docs/runs">structured logs</Link>, <Link href="/docs/runs">telemetry</Link> (rows, bytes,
          progress samples), and terminal state — same JSON body as <code>PATCH /api/elt/runs/:id</code> (session).
        </li>
        <li>
          <code>GET /api/agent/connections</code> — list connections with decrypted secret key/value pairs for the
          agent (use only in trusted runtime).
        </li>
        <li>
          <code>POST /api/agent/heartbeat</code> — liveness and version labels.
        </li>
        <li>
          <code>POST /api/agent/monitors/:id/report</code> — when a monitor is configured to run on the gateway,
          post evaluation results so the control plane updates timestamps and can enqueue a pipeline run.
        </li>
      </ul>

      <h2>Organization gateways</h2>
      <p>
        On Pro/Team, the org owner can create <strong>org-scoped</strong> gateway tokens. The workspace default gateway
        applies to unrouted runs when you work in that org context. Per-pipeline <strong>Runs on</strong> and per-run
        targeting still let you mix eltPulse-managed and customer gateways in one workspace.
      </p>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/docs/concepts">Concepts</Link> — pipelines, runs, connections, monitors, gateway targeting.
        </li>
        <li>
          <Link href="/docs/runs">Runs</Link> — logs, telemetry, and how workers PATCH runs.
        </li>
        <li>
          <Link href="/docs/orchestration">Orchestration</Link> — schedules, monitors, where monitors run.
        </li>
        <li>
          <Link href="/docs/security">Security &amp; data</Link> — what we store, how connections relate to agents.
        </li>
        <li>
          <Link href="/gateway">Gateway (in-app)</Link> — generate tokens and copy env snippets.
        </li>
      </ul>
    </DocsProse>
  );
}
