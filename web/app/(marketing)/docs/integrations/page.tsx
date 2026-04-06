import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Integrations",
  description: "GitHub, connectors, and environment configuration.",
};

export default function IntegrationsDocsPage() {
  return (
    <DocsProse>
      <h1>Integrations</h1>
      <p>
        The <Link href="/integrations">Integrations</Link> area covers how DataPulse connects to external systems on
        your behalf.
      </p>

      <h2>Managed GitHub (default)</h2>
      <p>
        In the standard product, <strong>customers do not sign in to GitHub</strong>. DataPulse provisions repositories
        under <strong>your</strong> GitHub organization using a GitHub App or machine user. Service credentials live
        only on the server.
      </p>

      <h2>Optional: bring your own GitHub</h2>
      <p>
        For enterprise or testing, operators can enable <code>CUSTOMER_GITHUB_OAUTH_ENABLED=true</code> so users may
        connect their own GitHub account. Tokens are encrypted at rest. This path is off by default.
      </p>

      <h2>ServicePulse</h2>
      <p>
        DataPulse and{" "}
        <a href="https://servicepulse.dev" target="_blank" rel="noreferrer">
          ServicePulse
        </a>{" "}
        can be linked from the in-app <Link href="/integrations">Integrations</Link> page: a handoff URL passes your
        deployment’s public base as <code>datapulse_origin</code> (no credentials). Pipeline{" "}
        <Link href="/runs">run webhooks</Link> include <code>source: &quot;datapulse&quot;</code> in the JSON payload
        so receivers can tell which product emitted the event. Set <code>NEXT_PUBLIC_SERVICEPULSE_URL</code> if
        ServicePulse runs on a non-default host.
      </p>

      <h2>Future connectors</h2>
      <p>
        Slack, warehouse SSO, and notification channels will appear here as the product matures — similar to how{" "}
        <a href="https://servicepulse.dev/docs#integrations" target="_blank" rel="noreferrer">
          ServicePulse
        </a>{" "}
        documents integrations by surface area.
      </p>

      <p>
        <Link href="/roadmap">Roadmap</Link> · <Link href="/docs/security">Security &amp; data</Link>
      </p>
    </DocsProse>
  );
}
