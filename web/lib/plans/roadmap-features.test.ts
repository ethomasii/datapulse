import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  airGapMetadataKillSwitchActive,
  enterpriseOrgIds,
  isEnterpriseOrganization,
  orgCanUseAirGappedMetadata,
  tierCanUseSso,
  tierEligibleForSso,
} from "./roadmap-features";

describe("roadmap-features", () => {
  const env = process.env;

  beforeEach(() => {
    process.env = { ...env };
  });

  afterEach(() => {
    process.env = env;
  });

  it("SSO is included on Team+", () => {
    expect(tierEligibleForSso("pro")).toBe(false);
    expect(tierEligibleForSso("team")).toBe(true);
    expect(tierCanUseSso("team")).toBe(true);
  });

  it("air-gap is included on Team+ without env enable flags", () => {
    delete process.env.ELTPULSE_AIRGAP_METADATA_ENABLED;
    delete process.env.ELTPULSE_AIRGAP_TEAM_PREVIEW;
    expect(orgCanUseAirGappedMetadata("org_x", "team")).toBe(true);
    expect(orgCanUseAirGappedMetadata("org_x", "pro")).toBe(false);
  });

  it("air-gap kill switch disables feature", () => {
    process.env.ELTPULSE_AIRGAP_DISABLED = "true";
    expect(airGapMetadataKillSwitchActive()).toBe(true);
    expect(orgCanUseAirGappedMetadata("org_x", "team")).toBe(false);
  });

  it("parses enterprise org ids", () => {
    process.env.ELTPULSE_ENTERPRISE_ORG_IDS = "org_a, org_b";
    expect(enterpriseOrgIds()).toEqual(["org_a", "org_b"]);
    expect(isEnterpriseOrganization("org_a")).toBe(true);
    expect(orgCanUseAirGappedMetadata("org_a", "free")).toBe(true);
  });
});
