"use client";

import { useState } from "react";
import Link from "next/link";
import { ExternalLink } from "lucide-react";
import {
  getSourceOAuthProvider,
  listOAuthConnectors,
} from "@/lib/integrations/source-oauth-providers";

type Props = {
  connector: string;
  connectionName?: string;
  className?: string;
};

/** OAuth "Connect" button for supported SaaS sources (HubSpot, Salesforce, Shopify). */
export function ConnectorOAuthButton({ connector, connectionName, className }: Props) {
  const slug = connector.toLowerCase();
  const provider = getSourceOAuthProvider(slug);
  const [shop, setShop] = useState("");

  if (!provider || !listOAuthConnectors().includes(slug)) return null;

  const name = connectionName?.trim() || `${provider.label} (OAuth)`;
  let href = `/api/integrations/oauth/${slug}/start?name=${encodeURIComponent(name)}`;

  if (provider.requiredConfig?.some((f) => f.key === "shop")) {
    return (
      <div className={`space-y-2 ${className ?? ""}`}>
        <label className="block text-xs font-medium text-slate-600 dark:text-slate-400">
          Shop domain (required for OAuth)
        </label>
        <input
          type="text"
          value={shop}
          onChange={(e) => setShop(e.target.value)}
          placeholder="my-store.myshopify.com"
          className="w-full rounded-lg border border-slate-300 px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
        />
        <Link
          href={
            shop.trim()
              ? `${href}&shop=${encodeURIComponent(shop.trim())}`
              : "#"
          }
          className={`inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100 ${
            !shop.trim() ? "pointer-events-none opacity-50" : ""
          }`}
        >
          Connect {provider.label}
          <ExternalLink className="h-3.5 w-3.5" aria-hidden />
        </Link>
        <p className="text-[11px] text-slate-500">
          Requires {provider.clientIdEnv} / {provider.clientSecretEnv} on the deployment.
        </p>
      </div>
    );
  }

  return (
    <div className={className}>
      <Link
        href={href}
        className="inline-flex items-center gap-2 rounded-lg border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-900 hover:bg-violet-100 dark:border-violet-800 dark:bg-violet-950/40 dark:text-violet-100"
      >
        Connect with {provider.label}
        <ExternalLink className="h-3.5 w-3.5" aria-hidden />
      </Link>
      <p className="mt-1.5 text-[11px] text-slate-500">
        OAuth — no manual API key paste. Configure app credentials in Vercel env.
      </p>
    </div>
  );
}

export function supportsConnectorOAuth(connector: string): boolean {
  return listOAuthConnectors().includes(connector.toLowerCase());
}
