/**
 * Managed mode (default): DataPulse hosts each customer’s definitions in **our** GitHub org using
 * a single GitHub App / machine user (tokens only on the server). Customers never authorize GitHub.
 *
 * Set `CUSTOMER_GITHUB_OAUTH_ENABLED=true` only for optional “bring your own GitHub org” or internal testing.
 */
export function isCustomerGithubOauthEnabled(): boolean {
  return process.env.CUSTOMER_GITHUB_OAUTH_ENABLED === "true";
}
