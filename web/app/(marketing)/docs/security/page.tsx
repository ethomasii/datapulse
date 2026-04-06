import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Security & data",
  description: "How DataPulse handles authentication, storage, and secrets.",
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
        Source and destination credentials belong in your execution environment (CI, runner, local `.env`), not in
        DataPulse — unless you explicitly use an optional integration that stores tokens server-side (e.g. BYO GitHub).
      </p>

      <h2>Billing</h2>
      <p>
        Stripe identifiers and plan tier are stored for subscription management. See{" "}
        <Link href="/account/billing">Billing</Link> under Account &amp; Settings.
      </p>

      <p>
        <Link href="/privacy">Privacy policy</Link> · <Link href="/terms">Terms</Link>
      </p>
    </DocsProse>
  );
}
