import { describe, expect, it } from "vitest";
import { resolveCronMonitorScale, stableMonitorShard } from "./cron-scale";

describe("stableMonitorShard", () => {
  it("maps to single bucket when count is 1", () => {
    expect(stableMonitorShard("u1", "m1", 1)).toBe(0);
  });

  it("is stable for same inputs", () => {
    expect(stableMonitorShard("user-a", "mon-x", 8)).toBe(stableMonitorShard("user-a", "mon-x", 8));
  });

  it("covers all buckets over many ids", () => {
    const buckets = new Set<number>();
    for (let i = 0; i < 500; i++) {
      buckets.add(stableMonitorShard(`u${i}`, `m${i}`, 7));
    }
    expect(buckets.size).toBe(7);
  });
});

describe("resolveCronMonitorScale", () => {
  it("parses query params", () => {
    const r = resolveCronMonitorScale("https://x.test/api/cron/monitors?shard=2&shards=5&budgetMs=12000", {});
    expect(r.shardIndex).toBe(2);
    expect(r.shardCount).toBe(5);
    expect(r.maxElapsedMs).toBe(12000);
  });

  it("ignores tiny budgetMs", () => {
    const r = resolveCronMonitorScale("https://x.test/api/cron/monitors?budgetMs=100", {});
    expect(r.maxElapsedMs).toBeUndefined();
  });
});
