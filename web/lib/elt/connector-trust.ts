import { ALL_DLT_SOURCES } from "@/lib/elt/dlt-hub-registry";
import { ALL_CONNECTORS } from "@/lib/elt/connectors-registry";

export type ConnectorTrustTier = "verified" | "beta" | "catalog";

const VERIFIED_SLUGS = new Set(
  ALL_DLT_SOURCES.filter((s) => s.sourceType !== "context").map((s) => s.slug)
);

const REGISTRY_SLUGS = new Set(ALL_CONNECTORS.map((c) => c.slug));

/** How production-ready codegen + credential UX is for this connector. */
export function getConnectorTrustTier(slug: string): ConnectorTrustTier {
  const key = slug.toLowerCase();
  if (VERIFIED_SLUGS.has(key)) return "verified";
  if (REGISTRY_SLUGS.has(key)) return "beta";
  return "catalog";
}

export const TRUST_LABELS: Record<ConnectorTrustTier, string> = {
  verified: "Verified",
  beta: "Beta",
  catalog: "Catalog",
};

export const TRUST_STYLES: Record<ConnectorTrustTier, string> = {
  verified:
    "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-200",
  beta: "bg-amber-100 text-amber-900 dark:bg-amber-950 dark:text-amber-200",
  catalog: "bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-300",
};
