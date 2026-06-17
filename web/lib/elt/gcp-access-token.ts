import { createSign } from "crypto";

type ServiceAccountJson = {
  client_email: string;
  private_key: string;
  project_id?: string;
};

export function parseServiceAccountJson(raw: string): ServiceAccountJson | null {
  try {
    const sa = JSON.parse(raw) as ServiceAccountJson;
    if (!sa.client_email?.trim() || !sa.private_key?.trim()) return null;
    return sa;
  } catch {
    return null;
  }
}

/** Exchange a GCP service account JSON blob for a short-lived OAuth access token. */
export async function fetchGcpAccessToken(
  serviceAccountJson: string,
  scope: string
): Promise<string> {
  const sa = parseServiceAccountJson(serviceAccountJson);
  if (!sa) throw new Error("Invalid service account JSON.");

  const now = Math.floor(Date.now() / 1000);
  const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
  const payload = Buffer.from(
    JSON.stringify({
      iss: sa.client_email,
      scope,
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })
  ).toString("base64url");

  const sign = createSign("RSA-SHA256");
  sign.update(`${header}.${payload}`);
  const sig = sign.sign(sa.private_key, "base64url");
  const jwt = `${header}.${payload}.${sig}`;

  const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    signal: AbortSignal.timeout(15_000),
  });
  const tokenData = (await tokenResp.json()) as { access_token?: string; error?: string };
  if (!tokenData.access_token) {
    throw new Error(tokenData.error ?? "GCP token exchange failed.");
  }
  return tokenData.access_token;
}
