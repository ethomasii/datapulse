import { describe, expect, it } from "vitest";
import { getRunSliceCapability, runSlicesAllowed } from "./run-slice-capabilities";

describe("run-slice-capabilities honesty", () => {
  it("marks full-replace verified sources as none_only", () => {
    for (const slug of ["google_sheets", "bing_webmaster", "inbox", "mux"]) {
      expect(getRunSliceCapability(slug).mode).toBe("none_only");
      expect(runSlicesAllowed(slug)).toBe(false);
    }
  });

  it("marks unwired incremental sources as none_only", () => {
    expect(getRunSliceCapability("braze").mode).toBe("none_only");
  });

  it("allows slices for freshdesk", () => {
    expect(runSlicesAllowed("freshdesk")).toBe(true);
  });

  it("allows slices for newly exposed verified sources", () => {
    for (const slug of ["pipedrive", "matomo", "workable", "personio", "strapi"]) {
      expect(runSlicesAllowed(slug)).toBe(true);
    }
  });

  it("defaults unknown sources to none_only instead of optimistic slices", () => {
    expect(getRunSliceCapability("some_unknown_saas").mode).toBe("none_only");
  });

  it("infers mux as full replace from verified spec + hub metadata", () => {
    expect(runSlicesAllowed("mux")).toBe(false);
    expect(getRunSliceCapability("mux").mode).toBe("none_only");
  });
});
