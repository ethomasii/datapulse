/**
 * Minimal eltPulse ↔ ServicePulse linking.
 *
 * Convention: ServicePulse may expose `/integrations/eltpulse` and read `eltpulse_origin`
 * (base URL of this eltPulse deployment, no secrets) to complete cross-product setup.
 */

const DEFAULT_SERVICEPULSE_BASE = "https://servicepulse.dev";

function stripTrailingSlash(s: string): string {
  return s.replace(/\/$/, "");
}

/** Public ServicePulse app origin (no trailing slash). Override with NEXT_PUBLIC_SERVICEPULSE_URL. */
export function getServicePulseBaseUrl(): string {
  const raw = process.env.NEXT_PUBLIC_SERVICEPULSE_URL?.trim() ?? "";
  if (raw && /^https?:\/\//i.test(raw)) return stripTrailingSlash(raw);
  return DEFAULT_SERVICEPULSE_BASE;
}

/** This eltPulse deployment’s public base URL (no trailing slash). */
export function getEltpulseAppPublicUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/**
 * Open in ServicePulse with context so it can associate this eltPulse tenant (URL only).
 * ServicePulse should treat unknown query params as optional until the route ships.
 */
export function servicePulseEltpulseHandoffUrl(): string {
  const base = getServicePulseBaseUrl();
  const u = new URL("/integrations/eltpulse", `${base}/`);
  u.searchParams.set("eltpulse_origin", getEltpulseAppPublicUrl());
  return u.toString();
}
