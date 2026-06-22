import { describe, expect, it } from "vitest";
import {
  COMPETITORS,
  FEATURED_COMPETITORS,
  FEATURED_COMPARE_SLUGS,
  MORE_COMPETITORS,
} from "./competitors";

describe("compare competitors tiers", () => {
  it("splits featured vs more without overlap", () => {
    expect(FEATURED_COMPETITORS.length + MORE_COMPETITORS.length).toBe(COMPETITORS.length);
    const featuredSlugs = new Set(FEATURED_COMPETITORS.map((c) => c.slug));
    for (const c of MORE_COMPETITORS) {
      expect(featuredSlugs.has(c.slug)).toBe(false);
    }
  });

  it("featured slugs resolve to competitors", () => {
    for (const slug of FEATURED_COMPARE_SLUGS) {
      expect(COMPETITORS.some((c) => c.slug === slug)).toBe(true);
    }
  });
});
