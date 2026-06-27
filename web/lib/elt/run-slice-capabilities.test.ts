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
    for (const slug of ["freshdesk", "personio", "strapi"]) {
      expect(getRunSliceCapability(slug).mode).toBe("none_only");
    }
  });

  it("allows slices for newly exposed verified sources", () => {
    for (const slug of ["pipedrive", "matomo", "workable"]) {
      expect(runSlicesAllowed(slug)).toBe(true);
    }
  });
});
