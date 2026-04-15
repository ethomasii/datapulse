import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Security & data",
  description: "How eltPulse handles authentication, storage, and secrets.",
};

export default function SecurityDocsPage() {
  return (
    <DocsProse>
      <h1>Security &amp; data</h1>

      <h2>Authentication</h2>
      <p>
        End users sign in with <strong>Clerk</strong>. We map Clerk users to rows in our database and scope all pipeline
        data by <code>userId</code>.
      </p>

      <h2>Data at rest</h2>
      <ul>
        <li>
          <strong>Pipeline definitions</strong> — Postgres (e.g. Neon): code, YAML, metadata.
        </li>
        <li>
          <strong>Optional GitHub OAuth tokens</strong> — AES-256-GCM encrypted with a server key; never logged to the
          client.
        </li>
      </ul>

      <h2>Secrets</h2>
      <p>
        Source and destination credentials for <strong>running ingestion</strong> usually live in your execution
        environment (CI, runner, local <code>.env</code>), not in eltPulse UI — unless you use an optional integration that
        stores tokens server-side (e.g. BYO GitHub).
      </p>

      <h2>Connections (saved profiles)</h2>
      <p>
        The <Link href="/connections">Connections</Link> page stores <strong>named profiles</strong> per user: connector
        type, non-secret <code>config</code>, and optionally <strong>encrypted secrets</strong> for use by trusted
        runtimes. Pipelines link saved profiles by id; generated artifacts may include resolved names for runners.{" "}
        <strong>Monitors</strong> can require
        a matching connection so S3/SQS checks know which credential profile to use.
      </p>
      <p>
        A gateway using a valid Bearer token may call <code>GET /api/agent/connections</code> and receive{" "}
        <strong>decrypted</strong> secret key/value pairs for that user&apos;s connections — only deploy gateways you
        trust with that data. See <Link href="/docs/concepts">Concepts</Link> and <Link href="/docs/gateway">Gateway</Link>
        .
      </p>

      <h2>Billing</h2>
      <p>
        Stripe identifiers and plan tier are stored for subscription management. See{" "}
        <Link href="/account/billing">Billing</Link> under Account &amp; Settings.
      </p>

      <p>
        <Link href="/docs/concepts">Concepts</Link> · <Link href="/privacy">Privacy policy</Link> ·{" "}
        <Link href="/terms">Terms</Link>
      </p>
    </DocsProse>
  );
}
