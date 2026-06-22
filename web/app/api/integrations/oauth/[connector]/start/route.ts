import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import {
  getSourceOAuthProvider,
  oauthProviderConfigured,
} from "@/lib/integrations/source-oauth-providers";
import { createOAuthState, oauthRedirectUri } from "@/lib/integrations/oauth-state";

type Ctx = { params: { connector: string } | Promise<{ connector: string }> };

/** GET /api/integrations/oauth/:connector/start — redirect to SaaS OAuth consent. */
export async function GET(req: Request, ctx: Ctx) {
  const params = await ctx.params;
  const connector = params.connector.toLowerCase();
  const provider = getSourceOAuthProvider(connector);
  if (!provider) {
    return NextResponse.json({ error: "OAuth not supported for this connector" }, { status: 404 });
  }
  if (!oauthProviderConfigured(provider)) {
    return NextResponse.json(
      { error: `${provider.label} OAuth is not configured on this deployment.` },
      { status: 503 }
    );
  }

  const user = await getCurrentDbUser();
  if (!user) {
    const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
    return NextResponse.redirect(`${base}/sign-in?redirect_url=${encodeURIComponent("/connections")}`);
  }

  const url = new URL(req.url);
  const connectionName = url.searchParams.get("name")?.trim() || `${provider.label} (OAuth)`;
  const shop = url.searchParams.get("shop")?.trim();
  const config: Record<string, string> = {};
  if (shop) config.shop = shop;

  for (const field of provider.requiredConfig ?? []) {
    const v = url.searchParams.get(field.key)?.trim();
    if (!v) {
      return NextResponse.json(
        { error: `Missing required parameter: ${field.key} (${field.label})` },
        { status: 400 }
      );
    }
    config[field.key] = v;
  }

  try {
    const state = createOAuthState({
      userId: user.id,
      connector,
      connectionName,
      returnTo: "/connections",
      config: Object.keys(config).length ? config : undefined,
    });
    const clientId = process.env[provider.clientIdEnv]!.trim();
    const redirectUri = oauthRedirectUri(connector);
    const authorizeUrl = provider.authorizeUrl({ clientId, redirectUri, state, config });
    return NextResponse.redirect(authorizeUrl);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "OAuth setup failed" },
      { status: 500 }
    );
  }
}
