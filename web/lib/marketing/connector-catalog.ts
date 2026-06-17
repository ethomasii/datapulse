import {
  DESTINATION_GROUPS,
  DESTINATION_OPTIONS,
  SOURCE_GROUPS,
  SOURCE_OPTIONS,
  SOURCE_TYPES,
} from "@/lib/elt/catalog";
import { chooseTool } from "@/lib/elt/choose-tool";
import { getConnectorTrustTier, type ConnectorTrustTier } from "@/lib/elt/connector-trust";
import { ALL_CONNECTORS } from "@/lib/elt/connectors-registry";
import { DLT_HUB_SOURCE_BY_SLUG } from "@/lib/elt/dlt-hub-registry";
import { connectorDisplayName } from "@/lib/marketing/connector-display-names";

/** Marketing-friendly aliases → canonical catalog slug */
const SLUG_ALIASES: Record<string, string> = {
  stripe: "stripe_analytics",
  shopify: "shopify_dlt",
  postgresql: "postgres",
};

export type MarketingConnectorRole = "source" | "destination";

export type MarketingConnector = {
  slug: string;
  name: string;
  description: string;
  category: string;
  role: MarketingConnectorRole;
  trustTier: ConnectorTrustTier;
  tool: "dlt" | "sling" | null;
  auth: string[];
  params: string[];
  incremental: boolean;
  docsUrl: string | null;
};

function descriptionForSlug(slug: string, role: MarketingConnectorRole): string {
  const dlt = DLT_HUB_SOURCE_BY_SLUG[slug];
  if (dlt?.description) return dlt.description;

  const conn = ALL_CONNECTORS.find((c) => c.slug === slug);
  if (conn?.label) {
    return `${conn.label} — ${role === "destination" ? "load pipeline output" : "extract data"} via eltPulse.`;
  }

  const label = connectorDisplayName(slug);
  if (role === "destination") {
    return `Load transformed data into ${label}. Supported as a pipeline destination in eltPulse.`;
  }
  return `Extract data from ${label}. Available in the eltPulse connector catalog with codegen and credential helpers.`;
}

function buildConnector(
  slug: string,
  name: string,
  category: string,
  role: MarketingConnectorRole
): MarketingConnector {
  const dlt = DLT_HUB_SOURCE_BY_SLUG[slug];
  const defaultDest = role === "source" ? "snowflake" : "postgres";
  const tool = role === "source" ? chooseTool(slug, defaultDest) : null;

  return {
    slug,
    name: dlt?.name ?? connectorDisplayName(slug, name),
    description: descriptionForSlug(slug, role),
    category,
    role,
    trustTier: getConnectorTrustTier(slug),
    tool,
    auth: dlt?.auth ?? [],
    params: dlt?.params ?? [],
    incremental: dlt?.incremental ?? false,
    docsUrl: dlt?.docsUrl ?? null,
  };
}

const SOURCE_MAP: Map<string, MarketingConnector> = new Map(
  SOURCE_OPTIONS.map((o) => [
    o.slug,
    buildConnector(o.slug, o.label, o.category, "source"),
  ])
);

const DEST_MAP: Map<string, MarketingConnector> = new Map(
  DESTINATION_OPTIONS.map((o) => [
    o.slug,
    buildConnector(o.slug, o.label, o.category, "destination"),
  ])
);

export function resolveConnectorSlug(raw: string): string {
  const key = raw.toLowerCase().trim();
  return SLUG_ALIASES[key] ?? key;
}

export function getMarketingConnector(slug: string): MarketingConnector | null {
  const resolved = resolveConnectorSlug(slug);
  return SOURCE_MAP.get(resolved) ?? DEST_MAP.get(resolved) ?? null;
}

export function getAllMarketingConnectors(): MarketingConnector[] {
  const seen = new Set<string>();
  const out: MarketingConnector[] = [];
  const all = [...Array.from(SOURCE_MAP.values()), ...Array.from(DEST_MAP.values())];
  for (const c of all) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
  }
  return out.sort((a, b) => a.name.localeCompare(b.name));
}

export function getMarketingSources(): MarketingConnector[] {
  return Array.from(SOURCE_MAP.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getMarketingDestinations(): MarketingConnector[] {
  return Array.from(DEST_MAP.values()).sort((a, b) => a.name.localeCompare(b.name));
}

export function getSourceCount(): number {
  return SOURCE_TYPES.length;
}

export function getConnectorCategories(role?: MarketingConnectorRole): string[] {
  const groups =
    role === "destination"
      ? DESTINATION_GROUPS
      : role === "source"
        ? SOURCE_GROUPS
        : { ...SOURCE_GROUPS, ...DESTINATION_GROUPS };
  return Object.keys(groups);
}

/** Suggested pairings when no scenario exists */
export function suggestedPairings(connector: MarketingConnector): MarketingConnector[] {
  const popularSources = ["github", "stripe_analytics", "postgres", "hubspot", "salesforce", "shopify_dlt"];
  const popularDests = ["snowflake", "bigquery", "postgres", "duckdb", "redshift"];

  if (connector.role === "source") {
    return popularDests
      .map((s) => DEST_MAP.get(s))
      .filter((c): c is MarketingConnector => Boolean(c))
      .slice(0, 4);
  }
  return popularSources
    .map((s) => SOURCE_MAP.get(s))
    .filter((c): c is MarketingConnector => Boolean(c))
    .slice(0, 4);
}

export function connectorCatalogStats() {
  return {
    sourceCount: SOURCE_TYPES.length,
    destinationCount: DESTINATION_OPTIONS.length,
    categoryCount: new Set([
      ...Object.keys(SOURCE_GROUPS),
      ...Object.keys(DESTINATION_GROUPS),
    ]).size,
  };
}
