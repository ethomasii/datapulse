import { describe, expect, it } from "vitest";
import {
  API_KEY_LIMITS,
  RUN_HISTORY_DAYS,
  runHistoryCutoff,
  tierAllowsOrgInvites,
  tierAllowsRunsApi,
  tierAllowsWebhookTriggers,
  tierAtLeast,
} from "./tier-features";

describe("tier-features", () => {
  it("orders tiers correctly", () => {
    expect(tierAtLeast("pro", "free")).toBe(true);
    expect(tierAtLeast("free", "pro")).toBe(false);
    expect(tierAtLeast("team", "team")).toBe(true);
  });

  it("gates pro-only automation features", () => {
    expect(tierAllowsWebhookTriggers("free")).toBe(false);
    expect(tierAllowsWebhookTriggers("pro")).toBe(true);
    expect(tierAllowsRunsApi("free")).toBe(false);
    expect(tierAllowsRunsApi("pro")).toBe(true);
  });

  it("gates team collaboration", () => {
    expect(tierAllowsOrgInvites("pro")).toBe(false);
    expect(tierAllowsOrgInvites("team")).toBe(true);
  });

  it("defines run history windows", () => {
    expect(RUN_HISTORY_DAYS.free).toBe(14);
    expect(RUN_HISTORY_DAYS.pro).toBe(90);
    expect(RUN_HISTORY_DAYS.team).toBe(365);
    const cutoff = runHistoryCutoff("free");
    expect(cutoff).toBeInstanceOf(Date);
    expect(cutoff!.getTime()).toBeLessThan(Date.now());
  });

  it("defines api key limits", () => {
    expect(API_KEY_LIMITS.free).toBe(1);
    expect(API_KEY_LIMITS.pro).toBe(5);
    expect(API_KEY_LIMITS.team).toBeNull();
  });
});
