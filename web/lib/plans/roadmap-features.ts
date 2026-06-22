import type { PlanTier } from "@prisma/client";
import { tierAtLeast } from "@/lib/plans/tier-features";

function envFlag(name: string): boolean {
  const v = process.env[name]?.trim().toLowerCase();
  return v === "1" || v === "true" || v === "yes";
}

function envIdList(name: string): string[] {
  return (process.env[name] ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

/** Ops kill-switch only — Team+ customers get air-gap by default. */
export function airGapMetadataKillSwitchActive(): boolean {
  return envFlag("ELTPULSE_AIRGAP_DISABLED");
}

/** Org ids with Enterprise contract (self-hosted control plane, custom SLAs). */
export function enterpriseOrgIds(): string[] {
  return envIdList("ELTPULSE_ENTERPRISE_ORG_IDS");
}

export function isEnterpriseOrganization(orgId: string | null | undefined): boolean {
  if (!orgId) return false;
  return enterpriseOrgIds().includes(orgId);
}

/** SSO / SAML included on Team and Enterprise plans. */
export function tierEligibleForSso(tier: PlanTier): boolean {
  return tierAtLeast(tier, "team");
}

/** Alias — entitlement is plan tier; IdP is configured in Clerk Dashboard. */
export function tierCanUseSso(tier: PlanTier): boolean {
  return tierEligibleForSso(tier);
}

/**
 * Air-gapped metadata export — included with Team+ (what they buy).
 * Enterprise org flag also qualifies. No per-customer env vars required.
 */
export function orgCanUseAirGappedMetadata(orgId: string | null | undefined, tier: PlanTier): boolean {
  if (airGapMetadataKillSwitchActive()) return false;
  if (isEnterpriseOrganization(orgId)) return true;
  return tierAtLeast(tier, "team");
}

/** @deprecated Use orgCanUseAirGappedMetadata — no global enable flag needed. */
export function airGappedMetadataEnabled(): boolean {
  return !airGapMetadataKillSwitchActive();
}

/** @deprecated SSO is tier-gated; configure SAML connections in Clerk Dashboard. */
export function ssoFeatureEnabled(): boolean {
  return true;
}
