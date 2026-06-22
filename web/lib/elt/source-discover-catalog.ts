/**
 * Client-safe discover catalog + config helpers (no pg/mysql/aws imports).
 */

export type DiscoverItem = {
  id: string;
  name: string;
  schema?: string;
  kind: "table" | "resource" | "prefix" | "endpoint";
  rowEstimate?: number | null;
  description?: string;
};

export type DiscoverResult = {
  ok: boolean;
  message: string;
  items: DiscoverItem[];
  defaultSelected?: string[];
};

/** Known dlt resources for SaaS sources without live API introspection yet. */
const DLT_RESOURCE_CATALOG: Record<string, DiscoverItem[]> = {
  github: [
    { id: "issues", name: "issues", kind: "resource", description: "Repository issues" },
    { id: "pull_requests", name: "pull_requests", kind: "resource", description: "Pull requests" },
    { id: "repo_events", name: "repo_events", kind: "resource", description: "Repository events" },
    { id: "stargazers", name: "stargazers", kind: "resource", description: "Stargazers" },
  ],
  stripe: [
    { id: "customers", name: "customers", kind: "resource" },
    { id: "charges", name: "charges", kind: "resource" },
    { id: "subscriptions", name: "subscriptions", kind: "resource" },
    { id: "invoices", name: "invoices", kind: "resource" },
    { id: "products", name: "products", kind: "resource" },
    { id: "events", name: "events", kind: "resource" },
  ],
  stripe_analytics: [
    { id: "customers", name: "customers", kind: "resource" },
    { id: "charges", name: "charges", kind: "resource" },
    { id: "subscriptions", name: "subscriptions", kind: "resource" },
  ],
  hubspot: [
    { id: "contacts", name: "contacts", kind: "resource" },
    { id: "companies", name: "companies", kind: "resource" },
    { id: "deals", name: "deals", kind: "resource" },
  ],
  shopify: [
    { id: "orders", name: "orders", kind: "resource" },
    { id: "products", name: "products", kind: "resource" },
    { id: "customers", name: "customers", kind: "resource" },
  ],
};

/** Whether a connector has a static dlt resource catalog (GitHub, Stripe, etc.). */
export function hasDiscoverCatalog(connector: string): boolean {
  return Boolean(DLT_RESOURCE_CATALOG[connector.toLowerCase()]?.length);
}

export function catalogResourcesForConnector(connector: string): DiscoverResult | null {
  const key = connector.toLowerCase();
  const items = DLT_RESOURCE_CATALOG[key];
  if (!items?.length) return null;
  return {
    ok: true,
    message: `Select ${connector} resources to sync.`,
    items,
    defaultSelected: items.slice(0, 3).map((i) => i.id),
  };
}

/** Apply discovered selection to sourceConfiguration for codegen. */
export function applyDiscoveryToSourceConfiguration(
  sourceType: string,
  base: Record<string, unknown>,
  selectedIds: string[]
): Record<string, unknown> {
  const out = { ...base };
  const t = sourceType.toLowerCase();
  const selected = selectedIds.filter(Boolean);

  if (t === "postgres" || t === "postgresql" || t === "mysql") {
    out.tables = selected.map((id) => (id.includes(".") ? id.split(".").pop()! : id)).join(", ");
    if (selected.some((id) => id.includes("."))) {
      const schema = selected[0]?.split(".")[0];
      if (schema) out.schema = schema;
    }
    return out;
  }

  if (t === "github" || t.includes("github")) {
    out.resources = selected.length ? selected : ["issues", "pull_requests"];
    return out;
  }

  if (t === "stripe" || t === "stripe_analytics") {
    out.resources = selected.length ? selected : ["customers", "charges"];
    return out;
  }

  if (t === "s3") {
    if (selected[0]) out.prefix = selected[0];
    return out;
  }

  if (selected.length) {
    out.resources = selected;
  }
  return out;
}
