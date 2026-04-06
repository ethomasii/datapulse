/** Must match the callback URL registered on the GitHub OAuth app. */
export function githubOAuthRedirectUri(): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/integrations/github/callback`;
}
