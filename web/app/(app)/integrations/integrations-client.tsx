"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ExternalLink, Loader2, Radio, Unplug } from "lucide-react";
import {
  getServicePulseBaseUrl,
  servicePulseEltpulseHandoffUrl,
} from "@/lib/integrations/servicepulse-url";

type Props = {
  githubLogin: string | null;
  defaultRepoLabel: string | null;
  oauthCallbackUrl: string;
  /** When true, show optional “connect your GitHub” (BYO). Default product: managed repos only. */
  showCustomerGithubOauth: boolean;
  /** Schema not applied — GitHub token storage table is missing locally. */
  githubTableMissing?: boolean;
};

const REASON_MESSAGES: Record<string, string> = {
  missing_params: "The GitHub redirect was incomplete. Try connecting again.",
  invalid_state: "Security check failed. Try connecting again.",
  not_configured: "GitHub OAuth is not configured on the server.",
  token_exchange: "GitHub did not return an access token.",
  encryption: "Could not store the token securely. Check server encryption settings.",
  github_user: "Could not read your GitHub profile.",
  disabled: "Customer GitHub connection is turned off for this deployment.",
};

export function IntegrationsClient({
  githubLogin,
  defaultRepoLabel,
  oauthCallbackUrl,
  showCustomerGithubOauth,
  githubTableMissing = false,
}: Props) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [disconnecting, setDisconnecting] = useState(false);
  const [banner, setBanner] = useState<{ kind: "ok" | "err"; text: string } | null>(null);

  const clearParams = useCallback(() => {
    router.replace("/integrations", { scroll: false });
  }, [router]);

  useEffect(() => {
    const g = searchParams.get("github");
    if (g === "connected") {
      setBanner({
        kind: "ok",
        text: "GitHub connected (optional integration). Set a default repository under Repositories when ready.",
      });
      clearParams();
    } else if (g === "denied") {
      setBanner({ kind: "err", text: "GitHub authorization was cancelled." });
      clearParams();
    } else if (g === "error") {
      const reason = searchParams.get("reason") ?? "";
      setBanner({
        kind: "err",
        text: REASON_MESSAGES[reason] ?? "Something went wrong connecting GitHub.",
      });
      clearParams();
    }
  }, [searchParams, clearParams, router]);

  async function disconnect() {
    if (!confirm("Remove the saved GitHub token from eltPulse?")) return;
    setDisconnecting(true);
    try {
      const res = await fetch("/api/integrations/github", { method: "DELETE" });
      if (!res.ok) throw new Error("Disconnect failed");
      router.refresh();
      setBanner({ kind: "ok", text: "Disconnected." });
    } catch {
      setBanner({ kind: "err", text: "Could not disconnect. Try again." });
    } finally {
      setDisconnecting(false);
    }
  }

  const byoGithubOnly = Boolean(githubLogin) && !showCustomerGithubOauth;

  return (
    <div className="space-y-8">
      {githubTableMissing && (
        <div
          role="status"
          className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 dark:border-amber-900/50 dark:bg-amber-950/30 dark:text-amber-100"
        >
          <p className="font-medium">Database schema is missing the GitHub connection table.</p>
          <p className="mt-2 text-amber-900/90 dark:text-amber-100/90">
            From the <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">web/</code> directory, apply the
            Prisma schema to your database (e.g. <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">npm run db:push</code>{" "}
            with <code className="rounded bg-white/80 px-1 text-xs dark:bg-slate-900">DATABASE_URL</code> set), then
            restart the dev server. OAuth callbacks need this table to store tokens.
          </p>
        </div>
      )}
      {banner && (
        <div
          role="alert"
          className={`rounded-xl border px-4 py-3 text-sm ${
            banner.kind === "ok"
              ? "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-100"
              : "border-red-200 bg-red-50 text-red-900 dark:border-red-900 dark:bg-red-950/40 dark:text-red-100"
          }`}
        >
          {banner.text}
        </div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Managed repositories</h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          In the default product, <strong>customers do not sign in to GitHub</strong>. eltPulse provisions a private
          repository per workspace under <strong>our</strong> GitHub organization and uses service credentials (GitHub
          App installation or machine user) to create branches, commits, and PRs. You control org policy, retention,
          and what is exposed in the product UI—similar to the original builder’s hosted model, with you operating the
          backing org.
        </p>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          Pipeline definitions you author in eltPulse are stored in Neon today; wiring automated commits into the
          managed repo is the next backend step (reuse{" "}
          <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">GITHUB_APP_ID</code> / installation
          tokens server-side—not end-user OAuth).
        </p>
        <p className="mt-4">
          <Link
            href="/repos"
            className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            Repositories →
          </Link>{" "}
          <span className="text-sm text-slate-500 dark:text-slate-500">
            (UI for default branch and visibility will land here.)
          </span>
        </p>
      </section>

      {byoGithubOnly && (
        <section
          className="rounded-2xl border border-amber-200 bg-amber-50/80 p-6 dark:border-amber-900/50 dark:bg-amber-950/20"
          role="region"
          aria-label="BYO GitHub connection"
        >
          <h2 className="text-lg font-semibold text-amber-950 dark:text-amber-100">Previous GitHub connection</h2>
          <p className="mt-2 text-sm text-amber-950/90 dark:text-amber-100/90">
            This workspace still has an optional personal GitHub link from when BYO was enabled. The product now uses
            managed repos; you can remove the stored token.
          </p>
          <p className="mt-2 text-sm">
            Connected as <span className="font-semibold">@{githubLogin}</span>
            {defaultRepoLabel ? (
              <>
                {" "}
                · <span className="font-mono text-xs">{defaultRepoLabel}</span>
              </>
            ) : null}
          </p>
          <button
            type="button"
            onClick={disconnect}
            disabled={disconnecting}
            className="mt-4 inline-flex items-center gap-2 rounded-lg border border-amber-300 bg-white px-3 py-2 text-sm font-medium text-amber-950 hover:bg-amber-100 disabled:opacity-50 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-100 dark:hover:bg-amber-900"
          >
            {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
            Remove stored token
          </button>
        </section>
      )}

      {showCustomerGithubOauth && (
        <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
          <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Optional: your own GitHub</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
            Enable only for experiments or enterprise deals where commits must land in the customer’s org. Requires{" "}
            <code className="rounded bg-slate-100 px-1 text-xs dark:bg-slate-800">CUSTOMER_GITHUB_OAUTH_ENABLED=true</code>{" "}
            and OAuth app env vars.
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-3">
            {githubLogin ? (
              <>
                <p className="text-sm text-slate-700 dark:text-slate-300">
                  Connected as <span className="font-semibold text-slate-900 dark:text-white">@{githubLogin}</span>
                  {defaultRepoLabel ? (
                    <>
                      {" "}
                      · default{" "}
                      <span className="font-mono text-xs text-slate-600 dark:text-slate-400">{defaultRepoLabel}</span>
                    </>
                  ) : null}
                </p>
                <button
                  type="button"
                  onClick={disconnect}
                  disabled={disconnecting}
                  className="inline-flex items-center gap-2 rounded-lg border border-slate-300 px-3 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
                >
                  {disconnecting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unplug className="h-4 w-4" />}
                  Disconnect
                </button>
              </>
            ) : (
              <a
                href="/api/integrations/github/start"
                className="inline-flex items-center gap-2 rounded-lg bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
              >
                Connect customer GitHub
                <ExternalLink className="h-4 w-4 opacity-80" aria-hidden />
              </a>
            )}
          </div>

          <p className="mt-4 text-xs text-slate-500 dark:text-slate-500">
            <span className="font-medium text-slate-600 dark:text-slate-400">OAuth app:</span> callback URL must be{" "}
            <code className="break-all rounded bg-slate-100 px-1 dark:bg-slate-800">{oauthCallbackUrl}</code>
            . Also set{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GITHUB_CLIENT_ID</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GITHUB_CLIENT_SECRET</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">GITHUB_OAUTH_STATE_SECRET</code>,{" "}
            <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">ELTPULSE_TOKEN_ENCRYPTION_KEY</code>.
          </p>
        </section>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Radio className="h-5 w-5 text-violet-600 dark:text-violet-400" aria-hidden />
          ServicePulse
        </h2>
        <p className="mt-2 max-w-2xl text-sm text-slate-600 dark:text-slate-400">
          <strong className="font-medium text-slate-800 dark:text-slate-200">Using ServicePulse does not go through
          eltPulse.</strong> Open{" "}
          <a
            href={getServicePulseBaseUrl()}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-sky-600 hover:underline dark:text-sky-400"
          >
            {getServicePulseBaseUrl()}
          </a>{" "}
          in your browser (or use the button below) and sign in there the same way you would any other app. eltPulse
          only adds optional links here for convenience. For automation,{" "}
          <Link href="/runs" className="font-medium text-sky-600 hover:underline dark:text-sky-400">
            run webhooks
          </Link>{" "}
          can point at ServicePulse when you configure a URL on the Runs page.
        </p>
        <div className="mt-4 flex flex-wrap gap-3">
          <a
            href={getServicePulseBaseUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg bg-violet-600 px-4 py-2 text-sm font-semibold text-white hover:bg-violet-700 dark:bg-violet-500 dark:hover:bg-violet-600"
          >
            Go to ServicePulse
            <ExternalLink className="h-4 w-4 opacity-90" aria-hidden />
          </a>
          <a
            href={servicePulseEltpulseHandoffUrl()}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-2 rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-900 dark:text-slate-100 dark:hover:bg-slate-800"
            title="Experimental: passes this eltPulse site URL as a query param when ServicePulse implements the landing page."
          >
            Open with eltPulse context
            <ExternalLink className="h-4 w-4 opacity-70" aria-hidden />
          </a>
        </div>
        <p className="mt-3 text-xs text-slate-500 dark:text-slate-500">
          The second link is optional cross-product wiring (adds <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">eltpulse_origin</code> from{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_APP_URL</code>). If that page does not
          exist on ServicePulse yet, use the main link only. Non-production ServicePulse: set{" "}
          <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">NEXT_PUBLIC_SERVICEPULSE_URL</code>.
        </p>
      </section>

      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-6 dark:border-slate-700 dark:bg-slate-900/30">
        <h2 className="text-sm font-semibold text-slate-800 dark:text-slate-200">More integrations</h2>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Slack, warehouse SSO, and notification channels will appear here.{" "}
          <Link href="/help" className="text-sky-600 hover:underline dark:text-sky-400">
            Request a connector
          </Link>
          .
        </p>
      </section>
    </div>
  );
}
