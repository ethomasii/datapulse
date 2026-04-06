/**
 * Minimal DataPulse ↔ ServicePulse linking.
 *
 * Convention: ServicePulse may expose `/integrations/datapulse` and read `datapulse_origin`
 * (base URL of this DataPulse deployment, no secrets) to complete cross-product setup.
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

/** This DataPulse deployment’s public base URL (no trailing slash). */
export function getDatapulseAppPublicUrl(): string {
  return stripTrailingSlash(process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000");
}

/**
 * Open in ServicePulse with context so it can associate this DataPulse tenant (URL only).
 * ServicePulse should treat unknown query params as optional until the route ships.
 */
export function servicePulseDatapulseHandoffUrl(): string {
  const base = getServicePulseBaseUrl();
  const u = new URL("/integrations/datapulse", `${base}/`);
  u.searchParams.set("datapulse_origin", getDatapulseAppPublicUrl());
  return u.toString();
}
