import { describe, expect, it } from "vitest";
import {
  ANNUAL_MONTHS_CHARGED,
  annualPriceFromMonthly,
  displayMonthlyUsd,
  ENTERPRISE_PLATFORM_FLOOR_USD,
  PLAN_PRICES_USD,
} from "./plan-pricing";

describe("plan-pricing", () => {
  it("annual is 10x monthly (save 2 months)", () => {
    expect(ANNUAL_MONTHS_CHARGED).toBe(10);
    expect(PLAN_PRICES_USD.pro.annual).toBe(PLAN_PRICES_USD.pro.monthly * 10);
    expect(annualPriceFromMonthly(29)).toBe(290);
  });

  it("enterprise platform floor is $24k/yr", () => {
    expect(ENTERPRISE_PLATFORM_FLOOR_USD.monthly).toBe(2400);
    expect(ENTERPRISE_PLATFORM_FLOOR_USD.annual).toBe(24_000);
  });

  it("displayMonthlyUsd shows monthly equivalent when annual", () => {
    expect(displayMonthlyUsd(29, "monthly")).toBe(29);
    expect(displayMonthlyUsd(29, "annual")).toBe(24);
    expect(displayMonthlyUsd(149, "annual")).toBe(124);
  });
});
