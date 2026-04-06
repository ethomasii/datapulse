/** Normalize optional webhook URL; empty string → null. Throws if non-empty and invalid. */
export function normalizeRunWebhookUrl(raw: string | null | undefined): string | null {
  if (raw === undefined || raw === null) return null;
  const t = String(raw).trim();
  if (!t) return null;
  let u: URL;
  try {
    u = new URL(t);
  } catch {
    throw new Error("Invalid URL");
  }
  if (u.protocol !== "https:" && u.protocol !== "http:") {
    throw new Error("URL must be http or https");
  }
  if (u.protocol === "http:" && process.env.NODE_ENV === "production") {
    throw new Error("Production webhooks must use https");
  }
  return t;
}
