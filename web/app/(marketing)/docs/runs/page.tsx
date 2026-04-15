import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Runs",
  description:
    "Execution history, structured logs, live telemetry (rows, bytes, progress), and how gateways report to the control plane.",
};

export default function RunsDocsPage() {
  return (
    <DocsProse>
      <h1>Runs</h1>
      <p>
        A <strong>run</strong> is one execution of a pipeline: status, timing, optional targeting to a named gateway, and
        everything your runner reports back — <strong>structured logs</strong>, <strong>telemetry</strong> (rows, bytes,
        progress), and sanitized errors. View and filter runs in the app at{" "}
        <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
          Runs
        </Link>
        .
      </p>

      <h2>Structured logs</h2>
      <p>
        Each run stores <code>logEntries</code> as a JSON array (capped at 500 lines server-side). Each entry has{" "}
        <code>at</code> (ISO time), <code>level</code> (<code>info</code>, <code>warn</code>, or <code>error</code>), and{" "}
        <code>message</code> (plain text, scrubbed — no raw warehouse credentials).
      </p>
      <ul>
        <li>
          <strong>Append one line:</strong> <code>PATCH</code> with <code>appendLog: {"{"} level, message {"}"}</code> — the
          server sets <code>at</code> to the request time.
        </li>
        <li>
          <strong>Replace the whole log:</strong> <code>PATCH</code> with <code>logEntries: [...]</code> (same shape as
          returned by <code>GET</code>).
        </li>
      </ul>
      <p>
        The same fields work on <code>PATCH /api/elt/runs/:id</code> (signed-in session) and{" "}
        <code>PATCH /api/agent/runs/:id</code> (Bearer gateway token). Managed workers and CI should use whichever auth
        path matches your deployment.
      </p>

      <h2>Telemetry (live + historical)</h2>
      <p>
        Runs also store <code>telemetry</code> as JSON with <code>summary</code> (rollup: rows, bytes, progress, phase,
        resource) and <code>samples</code> (time series, capped at 2000 points). This powers the Runs table columns,
        dashboard strip, and sparklines on run detail.
      </p>
      <ul>
        <li>
          <code>telemetrySummary</code> — shallow-merge into <code>summary</code> (e.g. cumulative{" "}
          <code>rowsLoaded</code>, <code>bytesLoaded</code>, <code>progress</code> 0–100, <code>currentPhase</code>,{" "}
          <code>currentResource</code>).
        </li>
        <li>
          <code>appendTelemetrySample</code> — append one point (optional <code>at</code>; defaults to now). Prefer
          calling every few seconds while <code>status</code> is <code>running</code>.
        </li>
        <li>
          <code>telemetrySamples</code> — replace the entire <code>samples</code> array (e.g. post-run backfill).
        </li>
      </ul>
      <p>
        Webhooks for terminal runs may include <code>telemetrySummary</code> in the JSON body when the run reported
        metrics. See <Link href="/webhooks">Webhooks</Link> for delivery rules.
      </p>

      <h2>Typical PATCH sequence</h2>
      <ol>
        <li>
          Create or claim a run (<code>POST /api/elt/runs</code> or poll <code>GET /api/agent/runs</code>).
        </li>
        <li>
          Set <code>status: &quot;running&quot;</code> and stream <code>appendLog</code> / <code>appendTelemetrySample</code>{" "}
          while work proceeds.
        </li>
        <li>
          Finish with <code>status: &quot;succeeded&quot;</code> (or <code>failed</code> / <code>cancelled</code>),{" "}
          optional <code>errorSummary</code>, final <code>telemetrySummary</code>, and <code>finishedAt</code> if needed.
        </li>
      </ol>

      <h2>Related</h2>
      <ul>
        <li>
          <Link href="/docs/concepts">Concepts</Link> — how runs relate to pipelines and gateways.
        </li>
        <li>
          <Link href="/docs/gateway">Gateway</Link> — Bearer routes including <code>PATCH /api/agent/runs/:id</code>.
        </li>
        <li>
          <Link href="/docs/pipelines">Pipelines</Link> — definitions that runs execute.
        </li>
        <li>
          <Link href="/docs/security">Security &amp; data</Link> — what we persist and what stays in your environment.
        </li>
      </ul>
    </DocsProse>
  );
}
