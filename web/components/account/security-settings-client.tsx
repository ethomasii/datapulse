"use client";

import Link from "next/link";
import { Shield, Mail } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { formatUsd, PLAN_PRICES_USD } from "@/lib/billing/plan-pricing";
import { AirgapMetadataPanel } from "@/components/account/airgap-metadata-panel";

export function SecuritySettingsClient({
  tier,
  ssoEnabled,
  ssoActive,
  ssoEligible,
  enterpriseOrg,
}: {
  tier: PlanTier;
  ssoEnabled: boolean;
  ssoActive: boolean;
  ssoEligible: boolean;
  enterpriseOrg: boolean;
}) {
  return (
    <div className="space-y-6">
      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Shield className="h-5 w-5 text-blue-600" />
          SSO / SAML
        </h2>
        {ssoActive ? (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            SSO is enabled for your workspace. Configure your identity provider in the{" "}
            <a
              href="https://clerk.com/docs/authentication/saml/overview"
              className="font-medium text-blue-600 hover:underline dark:text-blue-400"
              target="_blank"
              rel="noreferrer"
            >
              Clerk dashboard
            </a>
            .
          </p>
        ) : ssoEligible ? (
          <div className="mt-3 space-y-2 text-sm text-slate-600 dark:text-slate-400">
            <p>
              Team plans include SSO/SAML — we&apos;re rolling out IdP configuration now
              {ssoEnabled ? " (enabled in this environment)" : " (not yet enabled in this environment)"}.
            </p>
            <a
              href="mailto:hello@eltpulse.dev?subject=eltPulse%20SSO%20%2F%20SAML"
              className="inline-flex items-center gap-2 font-medium text-blue-600 hover:underline dark:text-blue-400"
            >
              <Mail className="h-4 w-4" />
              Contact us to enable SSO for your org
            </a>
          </div>
        ) : (
          <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
            SSO/SAML is available on Team and Enterprise.{" "}
            <Link href="/account/billing" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              Upgrade to Team
            </Link>{" "}
            or see{" "}
            <Link href="/pricing" className="font-medium text-blue-600 hover:underline dark:text-blue-400">
              pricing
            </Link>
            .
          </p>
        )}
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Self-hosted &amp; air-gapped</h2>
        <p className="mt-3 text-sm text-slate-600 dark:text-slate-400">
          <strong className="font-medium text-slate-800 dark:text-slate-200">Your compute, any plan:</strong> run a
          customer gateway on Free, Pro, or Team — you pay your infrastructure; Pro/Team subscription covers the
          eltPulse control plane and usage metering.
        </p>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          <strong className="font-medium text-slate-800 dark:text-slate-200">Enterprise control plane:</strong>{" "}
          self-hosted eltPulse (Docker) from{" "}
          {formatUsd(PLAN_PRICES_USD.enterprise.monthly)}/mo (
          {formatUsd(PLAN_PRICES_USD.enterprise.annual)}/yr billed annually) —{" "}
          <a
            href="mailto:hello@eltpulse.dev?subject=eltPulse%20Enterprise%20self-hosted"
            className="font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            contact sales
          </a>
          .
          {enterpriseOrg ? (
            <span className="mt-1 block text-emerald-700 dark:text-emerald-300">
              Your organization is flagged for Enterprise deployment.
            </span>
          ) : null}
        </p>
        <p className="mt-2 text-xs text-slate-500 dark:text-slate-500">
          Current plan: <span className="capitalize">{tier}</span>. Gateway limits and billing details on{" "}
          <Link href="/gateway" className="text-blue-600 hover:underline dark:text-blue-400">
            Gateway
          </Link>{" "}
          and{" "}
          <Link href="/account/billing" className="text-blue-600 hover:underline dark:text-blue-400">
            Billing
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Air-gapped metadata export (v1)</h2>
        <AirgapMetadataPanel />
      </section>
    </div>
  );
}
