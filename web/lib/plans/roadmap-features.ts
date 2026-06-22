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

/** Clerk SAML / SSO wired for this deployment. */
export function ssoFeatureEnabled(): boolean {
  return envFlag("ELTPULSE_SSO_ENABLED");
}

/** Restrict metadata sync to customer-controlled storage only. */
export function airGappedMetadataEnabled(): boolean {
  return envFlag("ELTPULSE_AIRGAP_METADATA_ENABLED");
}

/** Org ids with Enterprise contract (self-hosted control plane, custom SLAs). */
export function enterpriseOrgIds(): string[] {
  return envIdList("ELTPULSE_ENTERPRISE_ORG_IDS");
}

export function isEnterpriseOrganization(orgId: string | null | undefined): boolean {
  if (!orgId) return false;
  return enterpriseOrgIds().includes(orgId);
}

/** Team+ when SSO is enabled; otherwise preview-only for Team sales conversations. */
export function tierEligibleForSso(tier: PlanTier): boolean {
  return tierAtLeast(tier, "team");
}

export function tierCanUseSso(tier: PlanTier): boolean {
  return ssoFeatureEnabled() && tierEligibleForSso(tier);
}

/** Enterprise orgs (or global flag) for air-gapped metadata routing. */
export function orgCanUseAirGappedMetadata(orgId: string | null | undefined, tier: PlanTier): boolean {
  if (!airGappedMetadataEnabled()) return false;
  if (isEnterpriseOrganization(orgId)) return true;
  return tierAtLeast(tier, "team") && envFlag("ELTPULSE_AIRGAP_TEAM_PREVIEW");
}
