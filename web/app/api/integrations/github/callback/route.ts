import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import { verifyGithubOAuthState } from "@/lib/integrations/github-oauth-state";
import { githubOAuthRedirectUri } from "@/lib/integrations/github-app-url";
import { isCustomerGithubOauthEnabled } from "@/lib/integrations/customer-github-oauth";

function appBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

export async function GET(req: Request) {
  const url = new URL(req.url);
  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  const err = url.searchParams.get("error");
  const base = appBaseUrl();

  if (err) {
    return NextResponse.redirect(`${base}/integrations?github=denied`);
  }
  if (!code || !state) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=missing_params`);
  }

  if (!isCustomerGithubOauthEnabled()) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=disabled`);
  }

  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.redirect(`${base}/sign-in?redirect_url=${encodeURIComponent("/integrations")}`);
  }

  const stateUserId = verifyGithubOAuthState(state);
  if (!stateUserId || stateUserId !== user.id) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=invalid_state`);
  }

  const clientId = process.env.GITHUB_CLIENT_ID;
  const clientSecret = process.env.GITHUB_CLIENT_SECRET;
  if (!clientId || !clientSecret) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=not_configured`);
  }

  const redirectUri = githubOAuthRedirectUri();
  const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/x-www-form-urlencoded",
    },
    body: new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      code,
      redirect_uri: redirectUri,
    }),
  });

  const tokenJson = (await tokenRes.json()) as {
    access_token?: string;
    scope?: string;
    error?: string;
    error_description?: string;
  };

  if (!tokenRes.ok || !tokenJson.access_token) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=token_exchange`);
  }

  let accessTokenEnc: string;
  try {
    accessTokenEnc = encryptSecret(tokenJson.access_token);
  } catch {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=encryption`);
  }

  const ghUserRes = await fetch("https://api.github.com/user", {
    headers: {
      Authorization: `Bearer ${tokenJson.access_token}`,
      Accept: "application/vnd.github+json",
      "X-GitHub-Api-Version": "2022-11-28",
    },
  });

  if (!ghUserRes.ok) {
    return NextResponse.redirect(`${base}/integrations?github=error&reason=github_user`);
  }

  const ghUser = (await ghUserRes.json()) as { id: number; login: string };

  await db.githubConnection.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      githubUserId: String(ghUser.id),
      githubLogin: ghUser.login,
      accessTokenEnc,
      scope: tokenJson.scope ?? null,
    },
    update: {
      githubUserId: String(ghUser.id),
      githubLogin: ghUser.login,
      accessTokenEnc,
      scope: tokenJson.scope ?? null,
    },
  });

  return NextResponse.redirect(`${base}/integrations?github=connected`);
}
