import { describe, expect, it } from "vitest";
import { ALL_CONNECTORS, SOURCE_CONNECTOR_OPTIONS } from "./connectors-registry";
import { ALL_DLT_SOURCES } from "./dlt-hub-registry";
import { SOURCE_OPTIONS } from "./catalog";

describe("connectors-registry hub merge", () => {
  it("exposes all hub registry sources on the connections catalog", () => {
    const sourceSlugs = new Set(
      SOURCE_CONNECTOR_OPTIONS.map((o) => o.slug.toLowerCase())
    );
    for (const src of ALL_DLT_SOURCES) {
      expect(sourceSlugs.has(src.slug.toLowerCase())).toBe(true);
    }
    expect(SOURCE_CONNECTOR_OPTIONS.length).toBeGreaterThanOrEqual(ALL_DLT_SOURCES.length);
  });

  it("keeps manual connector definitions when slug overlaps hub", () => {
    const github = ALL_CONNECTORS.find((c) => c.slug === "github");
    expect(github?.credentialFields?.some((f) => f.key === "GITHUB_TOKEN")).toBe(true);
  });

  it("pipeline SOURCE_OPTIONS count stays in sync with hub registry", () => {
    expect(SOURCE_OPTIONS.length).toBeGreaterThanOrEqual(ALL_DLT_SOURCES.length);
  });
});
