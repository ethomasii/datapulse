"use client";

import Link from "next/link";
import { Shield, Mail } from "lucide-react";
import type { PlanTier } from "@prisma/client";
import { formatUsd, PLAN_PRICES_USD } from "@/lib/billing/plan-pricing";
import { AirgapMetadataPanel } from "@/components/account/airgap-metadata-panel";
import { SsoSettingsPanel } from "@/components/account/sso-settings-panel";

export function SecuritySettingsClient({
  tier,
  enterpriseOrg,
}: {
  tier: PlanTier;
  enterpriseOrg: boolean;
}) {
  return (
    <div className="space-y-6">
      <SsoSettingsPanel tier={tier} />

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="flex items-center gap-2 text-lg font-semibold text-slate-900 dark:text-white">
          <Shield className="h-5 w-5 text-blue-600" />
          Self-hosted &amp; compute
        </h2>
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
            className="inline-flex items-center gap-1 font-medium text-blue-600 hover:underline dark:text-blue-400"
          >
            <Mail className="h-3.5 w-3.5" />
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
          Current plan: <span className="capitalize">{tier}</span>. Gateway limits on{" "}
          <Link href="/gateway" className="text-blue-600 hover:underline dark:text-blue-400">
            Gateway
          </Link>{" "}
          · billing on{" "}
          <Link href="/account/billing" className="text-blue-600 hover:underline dark:text-blue-400">
            Billing
          </Link>
          .
        </p>
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <h2 className="text-lg font-semibold text-slate-900 dark:text-white">Air-gapped metadata export</h2>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Included on Team and Enterprise — mirror run metadata to your vault; cloud logs are redacted after successful
          export.
        </p>
        <AirgapMetadataPanel tier={tier} />
      </section>
    </div>
  );
}
