import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

function secret(): string {
  const s = process.env.GITHUB_OAUTH_STATE_SECRET;
  if (!s || s.length < 16) {
    throw new Error("GITHUB_OAUTH_STATE_SECRET must be set (min 16 characters)");
  }
  return s;
}

/** CSRF-safe OAuth state bound to the eltPulse DB user id. */
export function createGithubOAuthState(userId: string): string {
  const nonce = randomBytes(24).toString("hex");
  const sig = createHmac("sha256", secret())
    .update(`${userId}.${nonce}`)
    .digest("hex");
  return Buffer.from(`${userId}.${nonce}.${sig}`, "utf8").toString("base64url");
}

export function verifyGithubOAuthState(state: string): string | null {
  try {
    const raw = Buffer.from(state, "base64url").toString("utf8");
    const parts = raw.split(".");
    if (parts.length !== 3) return null;
    const [userId, nonce, sig] = parts;
    if (!userId || !nonce || !sig) return null;
    const expected = createHmac("sha256", secret()).update(`${userId}.${nonce}`).digest("hex");
    const a = Buffer.from(sig, "hex");
    const b = Buffer.from(expected, "hex");
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return userId;
  } catch {
    return null;
  }
}
