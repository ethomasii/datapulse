import { describe, expect, it } from "vitest";
import { parseRunTelemetry, runTelemetryToJson } from "@/lib/elt/run-telemetry";

describe("run-telemetry contract violations", () => {
  it("parses and serializes contract violations on telemetry", () => {
    const raw = {
      summary: {},
      samples: [],
      contractViolations: [
        {
          contractSlug: "orders-sla",
          contractName: "Orders SLA",
          assetKey: "pipeline:abc:raw.orders",
          issues: ["Freshness exceeded 24h"],
        },
      ],
    };
    const parsed = parseRunTelemetry(raw);
    expect(parsed.contractViolations).toHaveLength(1);
    expect(parsed.contractViolations?.[0].contractName).toBe("Orders SLA");
    const json = runTelemetryToJson(parsed);
    expect(json.contractViolations).toBeDefined();
  });
});
