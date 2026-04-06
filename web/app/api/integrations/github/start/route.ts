import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { createGithubOAuthState } from "@/lib/integrations/github-oauth-state";
import { githubOAuthRedirectUri } from "@/lib/integrations/github-app-url";
import { isCustomerGithubOauthEnabled } from "@/lib/integrations/customer-github-oauth";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  if (!isCustomerGithubOauthEnabled()) {
    return NextResponse.json(
      {
        error:
          "Customer GitHub OAuth is disabled. Repositories are managed by DataPulse using service credentials.",
      },
      { status: 404 }
    );
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    return NextResponse.json(
      { error: "GitHub OAuth is not configured (GITHUB_CLIENT_ID missing)." },
      { status: 503 }
    );
  }

  try {
    const state = createGithubOAuthState(user.id);
    const redirectUri = githubOAuthRedirectUri();
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      scope: "read:user repo",
      state,
    });
    return NextResponse.redirect(`https://github.com/login/oauth/authorize?${params.toString()}`);
  } catch (e) {
    const msg = e instanceof Error ? e.message : "OAuth setup error";
    return NextResponse.json({ error: msg }, { status: 503 });
  }
}
