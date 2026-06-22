import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { encryptSecret } from "@/lib/crypto/token-encryption";
import {
  getSourceOAuthProvider,
  oauthProviderConfigured,
} from "@/lib/integrations/source-oauth-providers";
import { oauthRedirectUri, verifyOAuthState } from "@/lib/integrations/oauth-state";

type Ctx = { params: { connector: string } | Promise<{ connector: string }> };

function appBase(): string {
  return (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
}

/** GET /api/integrations/oauth/:connector/callback */
export async function GET(req: Request, ctx: Ctx) {
  const params = await ctx.params;
  const connector = params.connector.toLowerCase();
  const base = appBase();
  const provider = getSourceOAuthProvider(connector);

  const url = new URL(req.url);
  const err = url.searchParams.get("error");
  if (err) {
    return NextResponse.redirect(`${base}/connections?oauth=denied&connector=${connector}`);
  }

  const code = url.searchParams.get("code");
  const state = url.searchParams.get("state");
  if (!code || !state || !provider) {
    return NextResponse.redirect(`${base}/connections?oauth=error&reason=missing_params`);
  }

  if (!oauthProviderConfigured(provider)) {
    return NextResponse.redirect(`${base}/connections?oauth=error&reason=not_configured`);
  }

  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.redirect(`${base}/sign-in?redirect_url=${encodeURIComponent("/connections")}`);
  }

  const payload = verifyOAuthState(state);
  if (!payload || payload.userId !== user.id || payload.connector !== connector) {
    return NextResponse.redirect(`${base}/connections?oauth=error&reason=invalid_state`);
  }

  const clientId = process.env[provider.clientIdEnv]!.trim();
  const clientSecret = process.env[provider.clientSecretEnv]!.trim();
  const redirectUri = oauthRedirectUri(connector);

  try {
    const tokens = await provider.exchangeCode({
      code,
      clientId,
      clientSecret,
      redirectUri,
      config: payload.config,
    });
    const secrets = provider.secretsFromTokens(tokens, payload.config);
    const enc = encryptSecret(JSON.stringify(secrets));

    const connection = await db.connection.create({
      data: {
        userId: user.id,
        name: payload.connectionName ?? `${provider.label} (OAuth)`,
        connectionType: "source",
        connector,
        config: (payload.config ?? {}) as object,
        connectionSecretsEnc: enc,
      },
    });

    return NextResponse.redirect(
      `${base}/connections?oauth=connected&connector=${connector}&connectionId=${connection.id}`
    );
  } catch {
    return NextResponse.redirect(`${base}/connections?oauth=error&reason=token_exchange`);
  }
}
