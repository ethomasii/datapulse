import { describe, expect, it } from "vitest";
import {
  readProcessSystemMetrics,
  systemMetricsEnabled,
  telemetryPatchWithSystem,
} from "@/lib/elt/agent-system-metrics";

describe("agent-system-metrics", () => {
  it("enabled by default", () => {
    expect(systemMetricsEnabled()).toBe(true);
  });

  it("returns memory metrics", () => {
    const m = readProcessSystemMetrics();
    expect(m?.memoryMb).toBeGreaterThan(0);
  });

  it("builds telemetry patch", () => {
    const patch = telemetryPatchWithSystem({ memoryMb: 128, cpuPercent: 12.5 });
    expect(patch.telemetrySummary?.system?.memoryMb).toBe(128);
    expect(patch.appendTelemetrySample?.system?.cpuPercent).toBe(12.5);
  });
});
