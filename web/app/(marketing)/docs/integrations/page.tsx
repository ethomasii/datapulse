import type { Metadata } from "next";
import Link from "next/link";
import { DocsProse } from "@/components/docs/docs-prose";

export const metadata: Metadata = {
  title: "Integrations",
  description: "GitHub, webhooks, MCP servers, ServicePulse, workspace API keys, and external systems.",
};

export default function IntegrationsDocsPage() {
  return (
    <DocsProse>
      <h1>Integrations</h1>
      <p>
        The <Link href="/integrations">Integrations</Link> area and related app pages cover how eltPulse connects to
        external systems. For how <Link href="/connections">Connections</Link> relate to pipelines, monitors, and
        gateways, see <Link href="/docs/concepts">Concepts</Link>.
      </p>

      <h2>GitHub</h2>
      <p>
        <strong>Managed GitHub (default)</strong> — in the standard product, customers do not sign in to GitHub
        directly. eltPulse provisions repositories under your organization using a GitHub App or machine user.
      </p>
      <p>
        <strong>Bring your own GitHub</strong> — operators can enable <code>CUSTOMER_GITHUB_OAUTH_ENABLED=true</code>{" "}
        so users connect personal or org accounts. Tokens are encrypted at rest. Off by default.
      </p>
      <p>
        Pipeline YAML auto-pushes on save when connected — see <Link href="/docs/repositories">Repositories</Link>.
      </p>

      <h2>Webhooks</h2>
      <p>
        <Link href="/webhooks">Webhooks</Link> support outgoing run notifications (global or per-pipeline) and incoming
        triggers via a workspace token. Full contract: <Link href="/docs/webhooks">Webhooks (docs)</Link>.
      </p>

      <h2>MCP servers</h2>
      <p>
        Register <Link href="/mcp-servers">MCP servers</Link> to extend Pulse AI with custom tools — HTTP or stdio
        transports, encrypted secrets, and a template catalog for common providers. Pulse AI invokes registered tools during
        AI-assisted pipeline editing.
      </p>

      <h2>Workspace API keys</h2>
      <p>
        Create Bearer tokens under <Link href="/account/developers">Account → Developers</Link> for automation — same
        REST endpoints as the browser session (pipelines, runs, connections, webhooks). Audit log entries record key
        usage where enabled.
      </p>

      <h2>ServicePulse</h2>
      <p>
        <a href="https://servicepulse.dev" target="_blank" rel="noreferrer">
          ServicePulse
        </a>{" "}
        is a separate product for service health and incident response. eltPulse includes a shortcut on Integrations;
        optional <code>eltpulse_origin</code> query param passes your deployment base URL for cross-product setup. Run
        webhooks may include <code>source: &quot;eltpulse&quot;</code> for receiver filtering. Set{" "}
        <code>NEXT_PUBLIC_SERVICEPULSE_URL</code> if ServicePulse is not at the default host.
      </p>

      <h2>Stripe &amp; Clerk</h2>
      <p>
        Billing uses Stripe (Team/Pro plans); authentication uses Clerk. Webhook endpoints for those providers are
        server-side only — not user-configurable.
      </p>

      <p>
        <Link href="/roadmap">Roadmap</Link> · <Link href="/docs/gateway">Gateway</Link> ·{" "}
        <Link href="/docs/security">Security &amp; data</Link>
      </p>
    </DocsProse>
  );
}
