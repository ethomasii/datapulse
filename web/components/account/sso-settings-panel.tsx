"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ExternalLink, ShieldCheck } from "lucide-react";
import type { PlanTier } from "@prisma/client";

type SsoPayload = {
  tier: string;
  eligible: boolean;
  active: boolean;
  clerkReady: boolean;
  connectionConfigured: boolean;
  instructions: string | null;
  clerkDashboardUrl: string;
  clerkSsoDocsUrl: string;
  signInUrl: string;
};

export function SsoSettingsPanel({ tier }: { tier: PlanTier }) {
  const [data, setData] = useState<SsoPayload | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/account/sso", { credentials: "same-origin" });
      if (res.ok) setData((await res.json()) as SsoPayload);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <p className="text-sm text-slate-500">Loading SSO settings…</p>
      </section>
    );
  }

  const eligible = data?.eligible ?? false;

  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
      <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
        <ShieldCheck className="h-5 w-5 text-blue-600" />
        SSO / SAML
      </h2>

      {!eligible ? (
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          SSO/SAML is included on Team and Enterprise.{" "}
          <Link href="/account/billing" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
            Upgrade to Team
          </Link>{" "}
          to enable your identity provider.
        </p>
      ) : (
        <div className="mt-3 space-y-3 text-sm text-slate-600 dark:text-slate-400">
          <p>
            <strong className="font-medium text-slate-800 dark:text-slate-200">Included on your plan.</strong>{" "}
            {data?.instructions}
          </p>
          <ol className="list-decimal space-y-2 pl-5">
            <li>
              Open the{" "}
              <a
                href={data?.clerkDashboardUrl ?? "https://dashboard.clerk.com"}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
              >
                Clerk Dashboard
                <ExternalLink className="h-3.5 w-3.5" />
              </a>{" "}
              → Configure → SSO / Enterprise connections.
            </li>
            <li>Add your IdP (Okta, Azure Entra ID, Google Workspace, etc.) and allowed email domains.</li>
            <li>
              Test at{" "}
              <Link href={data?.signInUrl ?? "/sign-in"} className="font-medium text-blue-600 hover:underline">
                Sign in
              </Link>{" "}
              — &quot;Continue with SSO&quot; appears automatically when connections are active.
            </li>
          </ol>
          {data?.connectionConfigured ? (
            <p className="rounded-lg bg-emerald-50 px-3 py-2 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200">
              Enterprise connection configured for this deployment.
            </p>
          ) : (
            <p className="text-xs text-slate-500">
              Need help? Email{" "}
              <a href="mailto:hello@eltpulse.dev" className="font-medium text-blue-600 hover:underline">
                hello@eltpulse.dev
              </a>{" "}
              with your IdP metadata — we&apos;ll configure it in Clerk for you.
            </p>
          )}
          <a
            href={data?.clerkSsoDocsUrl ?? "https://clerk.com/docs/authentication/enterprise-connections/overview"}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            Clerk SSO documentation
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      )}

      <p className="mt-3 text-xs text-slate-500 capitalize">Current plan: {tier}</p>
    </section>
  );
}
