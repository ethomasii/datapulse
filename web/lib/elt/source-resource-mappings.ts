export type SourceResourceNormalizer = (raw: unknown) => string[];

/** UI resource ids → dlt verified-source resource / endpoint names. */

export const STRIPE_UI_TO_ENDPOINT: Record<string, string> = {
  customers: "Customer",
  invoices: "Invoice",
  subscriptions: "Subscription",
  products: "Product",
  charges: "BalanceTransaction",
  events: "Event",
  accounts: "Account",
  coupons: "Coupon",
  prices: "Price",
};

export const STRIPE_IMPLEMENTED_ENDPOINTS = new Set([
  "Subscription",
  "Account",
  "Coupon",
  "Customer",
  "Invoice",
  "Product",
  "Price",
  "Event",
  "BalanceTransaction",
]);

export function normalizeStripeEndpoints(raw: unknown): string[] {
  const list = parseResourceList(raw, ["Customer", "Invoice", "Subscription"]);
  const mapped = list.map((id) => STRIPE_UI_TO_ENDPOINT[id.toLowerCase()] ?? id);
  const unique = Array.from(new Set(mapped.filter((e) => STRIPE_IMPLEMENTED_ENDPOINTS.has(e))));
  return unique.length > 0 ? unique : ["Customer", "Invoice", "Subscription"];
}

export const SHOPIFY_IMPLEMENTED_RESOURCES = new Set(["orders", "customers", "products"]);

export function normalizeShopifyResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["orders", "customers", "products"]);
  const unique = list.filter((r) => SHOPIFY_IMPLEMENTED_RESOURCES.has(r));
  return unique.length > 0 ? unique : ["orders", "customers", "products"];
}

export const HUBSPOT_IMPLEMENTED_RESOURCES = new Set([
  "contacts",
  "companies",
  "deals",
  "tickets",
  "products",
  "quotes",
]);

export function normalizeHubspotResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["contacts", "companies", "deals"]);
  return list.filter((r) => HUBSPOT_IMPLEMENTED_RESOURCES.has(r)).length > 0
    ? list.filter((r) => HUBSPOT_IMPLEMENTED_RESOURCES.has(r))
    : ["contacts", "companies", "deals"];
}

/** Salesforce UI object names → dlt resource function names on salesforce_source. */
export const SALESFORCE_UI_TO_RESOURCE: Record<string, string> = {
  Account: "account",
  Contact: "contact",
  Lead: "lead",
  Opportunity: "opportunity",
  OpportunityLineItem: "opportunity_line_item",
  Campaign: "campaign",
  CampaignMember: "campaign_member",
  Product2: "product_2",
  Pricebook2: "pricebook_2",
  PricebookEntry: "pricebook_entry",
  Task: "task",
  Event: "event",
  User: "sf_user",
  UserRole: "user_role",
};

export const SALESFORCE_IMPLEMENTED_RESOURCES = new Set(Object.values(SALESFORCE_UI_TO_RESOURCE));

export function normalizeSalesforceResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["account", "contact", "lead"]);
  const mapped = list.map((id) => SALESFORCE_UI_TO_RESOURCE[id] ?? id.toLowerCase());
  const unique = Array.from(new Set(mapped.filter((r) => SALESFORCE_IMPLEMENTED_RESOURCES.has(r))));
  return unique.length > 0 ? unique : ["account", "contact", "lead"];
}

export const ZENDESK_IMPLEMENTED_RESOURCES = new Set([
  "tickets",
  "users",
  "organizations",
  "groups",
]);

export function normalizeZendeskResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["tickets", "users"]);
  const unique = list.filter((r) => ZENDESK_IMPLEMENTED_RESOURCES.has(r));
  return unique.length > 0 ? unique : ["tickets", "users"];
}

export const JIRA_IMPLEMENTED_RESOURCES = new Set(["issues", "users", "projects", "workflows"]);

export function normalizeJiraResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["issues", "projects"]);
  const unique = list.filter((r) => JIRA_IMPLEMENTED_RESOURCES.has(r));
  return unique.length > 0 ? unique : ["issues", "projects"];
}

export const SLACK_IMPLEMENTED_RESOURCES = new Set(["channels", "users", "access_logs"]);

export function normalizeSlackResources(raw: unknown): string[] {
  const list = parseResourceList(raw, ["channels", "users"]);
  const unique = list.filter((r) => SLACK_IMPLEMENTED_RESOURCES.has(r));
  return unique.length > 0 ? unique : ["channels", "users"];
}

function parseResourceList(raw: unknown, fallback: string[]): string[] {
  const list = Array.isArray(raw)
    ? raw.map(String)
    : typeof raw === "string"
      ? raw.split(",").map((x) => x.trim()).filter(Boolean)
      : fallback;
  return Array.from(new Set(list.map((r) => r.trim()).filter(Boolean)));
}

/** Read resource ids from pipeline sourceConfiguration (handles Salesforce standard_objects). */
export function readResourceSelection(
  sourceType: string,
  config: Record<string, unknown>
): unknown {
  const t = sourceType.toLowerCase();
  if (t === "salesforce") {
    return config.standard_objects ?? config.resources;
  }
  return config.resources;
}
