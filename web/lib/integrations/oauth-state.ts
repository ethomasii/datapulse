import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s =
    process.env.ELTPULSE_OAUTH_STATE_SECRET ??
    process.env.GITHUB_OAUTH_STATE_SECRET ??
    process.env.ELTPULSE_INTERNAL_API_SECRET;
  if (!s || s.length < 16) {
    throw new Error(
      "Set ELTPULSE_OAUTH_STATE_SECRET (or GITHUB_OAUTH_STATE_SECRET / ELTPULSE_INTERNAL_API_SECRET) for OAuth"
    );
  }
  return s;
}

export type OAuthStatePayload = {
  userId: string;
  connector: string;
  connectionName?: string;
  returnTo?: string;
  /** Shopify shop domain, Salesforce instance hint, etc. */
  config?: Record<string, string>;
};

/** CSRF-safe OAuth state bound to user + connector. */
export function createOAuthState(payload: OAuthStatePayload): string {
  const nonce = randomBytes(24).toString("hex");
  const body = JSON.stringify({ ...payload, nonce });
  const sig = createHmac("sha256", secret()).update(body).digest("hex");
  return Buffer.from(JSON.stringify({ body, sig }), "utf8").toString("base64url");
}

export function verifyOAuthState(state: string): OAuthStatePayload | null {
  try {
    const parsed = JSON.parse(Buffer.from(state, "base64url").toString("utf8")) as {
      body?: string;
      sig?: string;
    };
    if (!parsed.body || !parsed.sig) return null;
    const expected = createHmac("sha256", secret()).update(parsed.body).digest("hex");
    const a = Buffer.from(parsed.sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    const payload = JSON.parse(parsed.body) as OAuthStatePayload & { nonce?: string };
    const { nonce: _n, ...rest } = payload;
    if (!rest.userId || !rest.connector) return null;
    return rest;
  } catch {
    return null;
  }
}

export function oauthRedirectUri(connector: string): string {
  const base = (process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000").replace(/\/$/, "");
  return `${base}/api/integrations/oauth/${connector}/callback`;
}
