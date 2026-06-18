import { describe, expect, it } from "vitest";
import { buildAssetRunHistory, runTouchesAsset } from "@/lib/elt/asset-run-history";
import type { WorkspaceAsset } from "@/lib/elt/pipeline-assets";

const rawAsset: WorkspaceAsset = {
  id: "p1:raw:orders",
  kind: "raw",
  name: "orders",
  displayName: "orders",
  pipelineId: "p1",
  pipelineName: "Shop",
  syncMode: "full_refresh",
  sourceType: "stripe",
  destinationType: "postgres",
  landingQualified: "public.orders",
  enabled: true,
};

describe("asset-run-history", () => {
  it("matches raw asset when telemetry resource matches", () => {
    const run = {
      id: "r1",
      status: "succeeded",
      environment: "default",
      startedAt: new Date("2024-06-01T12:00:00Z"),
      finishedAt: new Date("2024-06-01T12:05:00Z"),
      triggeredBy: null,
      partitionColumn: null,
      partitionValue: null,
      telemetry: {
        summary: { rowsLoaded: 100 },
        samples: [{ resource: "orders", rows: 100, at: "2024-06-01T12:05:00Z" }],
      },
      logEntries: [],
    };
    expect(runTouchesAsset(rawAsset, run)).toBe(true);
    const history = buildAssetRunHistory(rawAsset, [run]);
    expect(history[0]?.touched).toBe(true);
    expect(history[0]?.rowsLoaded).toBe(100);
  });
});
