import { isClerkConfigured } from "@/lib/clerk/is-configured";

/** Clerk Dashboard → Configure → SSO / Enterprise connections */
export const CLERK_SSO_DOCS_URL =
  "https://clerk.com/docs/authentication/enterprise-connections/overview";

/** Clerk Dashboard → Configure → Restrictions (optional domain allowlist) */
export const CLERK_DASHBOARD_URL = "https://dashboard.clerk.com";

/**
 * SAML / OIDC enterprise connections are configured in Clerk Dashboard.
 * The SignIn component surfaces them automatically when connections exist.
 */
export function clerkEnterpriseSsoReady(): boolean {
  return isClerkConfigured();
}

/** Optional ops hint that at least one enterprise connection exists in Clerk. */
export function clerkEnterpriseConnectionConfigured(): boolean {
  const raw = process.env.CLERK_ENTERPRISE_CONNECTION_ID?.trim();
  return Boolean(raw);
}

export function ssoSetupInstructionsForTeam(): string {
  return (
    "Team includes SSO/SAML. Add your IdP (Okta, Azure Entra ID, Google Workspace, etc.) " +
    "as an Enterprise connection in the Clerk Dashboard, then map allowed email domains. " +
    "The sign-in page will show Continue with SSO automatically."
  );
}
