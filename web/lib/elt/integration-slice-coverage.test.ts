import { describe, expect, it } from "vitest";
import {
  TIER1_PIPELINE_SOURCES,
  TIER1_NONE_ONLY_OK,
  auditIntegrationSliceCoverage,
  tier1IntegrationGaps,
  tier1SliceCoveragePercent,
} from "./integration-slice-coverage";
import { runSlicesAllowed } from "./run-slice-capabilities";

describe("tier-1 integration slice coverage", () => {
  it("covers at least 85% of tier-1 sources with run slices or declared none_only", () => {
    expect(tier1SliceCoveragePercent()).toBeGreaterThanOrEqual(85);
  });

  it("allows run slices on core Fivetran-competitive connectors", () => {
    const mustSlice = [
      "github",
      "hubspot",
      "salesforce",
      "shopify",
      "postgres",
      "slack",
      "jira",
      "zendesk",
      "freshdesk",
      "pipedrive",
      "intercom",
      "mixpanel",
      "s3",
    ];
    for (const slug of mustSlice) {
      expect(runSlicesAllowed(slug), slug).toBe(true);
    }
  });

  it("has no vendored-source gaps on tier-1 verified connectors", () => {
    const gaps = tier1IntegrationGaps().filter(
      (g) => g.issue?.includes("not vendored") && TIER1_PIPELINE_SOURCES.includes(g.slug as (typeof TIER1_PIPELINE_SOURCES)[number])
    );
    expect(gaps.map((g) => g.slug)).toEqual([]);
  });

  it("audits every tier-1 slug", () => {
    expect(auditIntegrationSliceCoverage().length).toBe(TIER1_PIPELINE_SOURCES.length);
  });

  it("marks google ads as honestly none_only on tier-1 bar", () => {
    expect(TIER1_NONE_ONLY_OK.has("google_ads")).toBe(true);
    expect(runSlicesAllowed("google_ads")).toBe(false);
  });

  it("marks segment as none_only outside tier-1 bar", () => {
    expect(TIER1_NONE_ONLY_OK.has("segment")).toBe(true);
    expect(runSlicesAllowed("segment")).toBe(false);
  });
});
