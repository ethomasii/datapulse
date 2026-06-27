import { describe, expect, it } from "vitest";
import { parseLogLineForTelemetry } from "@/lib/elt/telemetry-log-parser";

describe("parseLogLineForTelemetry", () => {
  it("parses phase markers", () => {
    const r = parseLogLineForTelemetry("[eltpulse] phase:load");
    expect(r?.patch.telemetrySummary?.currentPhase).toBe("load");
    expect(r?.patch.appendTelemetrySample?.progress).toBe(70);
  });

  it("parses resource markers", () => {
    const r = parseLogLineForTelemetry("[eltpulse] resource:orders rows:1200 bytes:45000");
    expect(r?.patch.telemetrySummary?.rowsLoaded).toBe(1200);
    expect(r?.patch.telemetrySummary?.bytesLoaded).toBe(45000);
    expect(r?.patch.appendTelemetrySample?.resource).toBe("orders");
  });

  it("parses dlt rows loaded lines", () => {
    const r = parseLogLineForTelemetry("Finished: 1,234 rows loaded into warehouse");
    expect(r?.patch.telemetrySummary?.rowsLoaded).toBe(1234);
  });

  it("parses dlt normalize table row lines", () => {
    const r = parseLogLineForTelemetry("- issues: 500 row(s)");
    expect(r?.patch.telemetrySummary?.rowsLoaded).toBe(500);
    expect(r?.patch.telemetrySummary?.currentResource).toBe("issues");
  });
});
