/**
 * OAuth 2.0 for SaaS source connectors (Fivetran-style "Connect" instead of paste API key).
 */

export type SourceOAuthProvider = {
  connector: string;
  label: string;
  /** Env var names for client id/secret */
  clientIdEnv: string;
  clientSecretEnv: string;
  scopes: string[];
  /** Build authorize URL */
  authorizeUrl: (params: {
    clientId: string;
    redirectUri: string;
    state: string;
    config?: Record<string, string>;
  }) => string;
  /** Exchange code for tokens */
  exchangeCode: (params: {
    code: string;
    clientId: string;
    clientSecret: string;
    redirectUri: string;
    config?: Record<string, string>;
  }) => Promise<Record<string, string>>;
  /** Map token response → Connection secret keys */
  secretsFromTokens: (tokens: Record<string, string>, config?: Record<string, string>) => Record<string, string>;
  /** Optional config fields required before OAuth (e.g. Shopify shop) */
  requiredConfig?: { key: string; label: string; placeholder?: string }[];
};

const PROVIDERS: Record<string, SourceOAuthProvider> = {
  hubspot: {
    connector: "hubspot",
    label: "HubSpot",
    clientIdEnv: "HUBSPOT_CLIENT_ID",
    clientSecretEnv: "HUBSPOT_CLIENT_SECRET",
    scopes: [
      "crm.objects.contacts.read",
      "crm.objects.companies.read",
      "crm.objects.deals.read",
      "crm.schemas.contacts.read",
    ],
    authorizeUrl: ({ clientId, redirectUri, state }) => {
      const p = new URL("https://app.hubspot.com/oauth/authorize");
      p.searchParams.set("client_id", clientId);
      p.searchParams.set("redirect_uri", redirectUri);
      p.searchParams.set("scope", PROVIDERS.hubspot!.scopes.join(" "));
      p.searchParams.set("state", state);
      return p.toString();
    },
    exchangeCode: async ({ code, clientId, clientSecret, redirectUri }) => {
      const res = await fetch("https://api.hubapi.com/oauth/v1/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      const json = (await res.json()) as Record<string, string>;
      if (!res.ok) throw new Error(json.message ?? json.error ?? "HubSpot token exchange failed");
      return json;
    },
    secretsFromTokens: (tokens) => ({
      HUBSPOT_API_KEY: tokens.access_token ?? "",
      ...(tokens.refresh_token ? { HUBSPOT_REFRESH_TOKEN: tokens.refresh_token } : {}),
    }),
  },

  salesforce: {
    connector: "salesforce",
    label: "Salesforce",
    clientIdEnv: "SALESFORCE_CLIENT_ID",
    clientSecretEnv: "SALESFORCE_CLIENT_SECRET",
    scopes: ["api", "refresh_token", "offline_access"],
    authorizeUrl: ({ clientId, redirectUri, state }) => {
      const loginHost = process.env.SALESFORCE_LOGIN_HOST ?? "login.salesforce.com";
      const p = new URL(`https://${loginHost}/services/oauth2/authorize`);
      p.searchParams.set("response_type", "code");
      p.searchParams.set("client_id", clientId);
      p.searchParams.set("redirect_uri", redirectUri);
      p.searchParams.set("scope", PROVIDERS.salesforce!.scopes.join(" "));
      p.searchParams.set("state", state);
      return p.toString();
    },
    exchangeCode: async ({ code, clientId, clientSecret, redirectUri }) => {
      const loginHost = process.env.SALESFORCE_LOGIN_HOST ?? "login.salesforce.com";
      const res = await fetch(`https://${loginHost}/services/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
          grant_type: "authorization_code",
          client_id: clientId,
          client_secret: clientSecret,
          redirect_uri: redirectUri,
          code,
        }),
      });
      const json = (await res.json()) as Record<string, string>;
      if (!res.ok) throw new Error(json.error_description ?? json.error ?? "Salesforce token exchange failed");
      return json;
    },
    secretsFromTokens: (tokens) => ({
      SALESFORCE_ACCESS_TOKEN: tokens.access_token ?? "",
      ...(tokens.refresh_token ? { SALESFORCE_REFRESH_TOKEN: tokens.refresh_token } : {}),
      ...(tokens.instance_url ? { SALESFORCE_INSTANCE_URL: tokens.instance_url } : {}),
    }),
  },

  shopify: {
    connector: "shopify",
    label: "Shopify",
    clientIdEnv: "SHOPIFY_CLIENT_ID",
    clientSecretEnv: "SHOPIFY_CLIENT_SECRET",
    scopes: ["read_products", "read_orders", "read_customers", "read_inventory"],
    requiredConfig: [
      { key: "shop", label: "Shop domain", placeholder: "my-store.myshopify.com" },
    ],
    authorizeUrl: ({ clientId, redirectUri, state, config }) => {
      const shop = (config?.shop ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!shop) throw new Error("Shop domain is required for Shopify OAuth");
      const p = new URL(`https://${shop}/admin/oauth/authorize`);
      p.searchParams.set("client_id", clientId);
      p.searchParams.set("scope", PROVIDERS.shopify!.scopes.join(","));
      p.searchParams.set("redirect_uri", redirectUri);
      p.searchParams.set("state", state);
      return p.toString();
    },
    exchangeCode: async ({ code, clientId, clientSecret, redirectUri, config }) => {
      const shop = (config?.shop ?? "").trim().replace(/^https?:\/\//, "").replace(/\/$/, "");
      if (!shop) throw new Error("Shop domain missing");
      const res = await fetch(`https://${shop}/admin/oauth/access_token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          client_id: clientId,
          client_secret: clientSecret,
          code,
        }),
      });
      const json = (await res.json()) as Record<string, string>;
      if (!res.ok) throw new Error(json.error ?? "Shopify token exchange failed");
      return { ...json, shop };
    },
    secretsFromTokens: (tokens, config) => ({
      SHOPIFY_ACCESS_TOKEN: tokens.access_token ?? "",
      SHOPIFY_SHOP: tokens.shop ?? config?.shop ?? "",
    }),
  },
};

export function getSourceOAuthProvider(connector: string): SourceOAuthProvider | null {
  return PROVIDERS[connector.toLowerCase()] ?? null;
}

export function listOAuthConnectors(): string[] {
  return Object.keys(PROVIDERS);
}

export function oauthProviderConfigured(provider: SourceOAuthProvider): boolean {
  return Boolean(
    process.env[provider.clientIdEnv]?.trim() && process.env[provider.clientSecretEnv]?.trim()
  );
}
