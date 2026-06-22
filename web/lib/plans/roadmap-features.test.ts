import { describe, expect, it, beforeEach, afterEach } from "vitest";
import {
  enterpriseOrgIds,
  isEnterpriseOrganization,
  ssoFeatureEnabled,
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

  it("sso requires env flag and team tier", () => {
    process.env.ELTPULSE_SSO_ENABLED = "false";
    expect(ssoFeatureEnabled()).toBe(false);
    expect(tierCanUseSso("team")).toBe(false);

    process.env.ELTPULSE_SSO_ENABLED = "true";
    expect(tierEligibleForSso("pro")).toBe(false);
    expect(tierCanUseSso("team")).toBe(true);
  });

  it("parses enterprise org ids", () => {
    process.env.ELTPULSE_ENTERPRISE_ORG_IDS = "org_a, org_b";
    expect(enterpriseOrgIds()).toEqual(["org_a", "org_b"]);
    expect(isEnterpriseOrganization("org_a")).toBe(true);
    expect(isEnterpriseOrganization("org_c")).toBe(false);
  });
});
