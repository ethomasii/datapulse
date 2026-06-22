import { describe, expect, it } from "vitest";
import { buildAirgapRunExportPayload } from "./airgap-metadata-export";

import { cloudStorageAfterSuccessfulAirgapExport } from "./airgap-metadata-export";

describe("airgap-metadata-export", () => {
  it("builds redacted terminal run payload", () => {
    const payload = buildAirgapRunExportPayload({
      organizationId: "org_1",
      run: {
        id: "run_1",
        status: "succeeded",
        environment: "prod",
        correlationId: "corr_1",
        errorSummary: null,
        startedAt: new Date("2026-01-01T00:00:00Z"),
        finishedAt: new Date("2026-01-01T00:05:00Z"),
        ingestionExecutor: "customer_agent",
        telemetry: { summary: { rowsLoaded: 1000 } },
        pipelineId: "pipe_1",
        pipeline: { name: "orders" },
        dbtProject: null,
      },
    });

    expect(payload).toMatchObject({
      source: "eltpulse",
      exportKind: "run.metadata",
      organizationId: "org_1",
      event: "run.succeeded",
      pipelineName: "orders",
      telemetrySummary: { rowsLoaded: 1000 },
    });
    expect(payload).not.toHaveProperty("logEntries");
  });

  it("redacts cloud storage after successful export (v2)", () => {
    const redacted = cloudStorageAfterSuccessfulAirgapExport({
      summary: { rowsLoaded: 500, bytesLoaded: 12000 },
      samples: [{ at: "2026-01-01T00:00:00Z", rowsLoaded: 100 }],
      dbt: { models: [{ name: "dim_users" }] },
    });
    expect(redacted.logEntries).toHaveLength(1);
    expect(redacted.telemetry).toMatchObject({
      summary: { rowsLoaded: 500, bytesLoaded: 12000 },
      samples: [],
    });
    expect(redacted.telemetry).not.toHaveProperty("dbt");
  });

  it("returns null for non-terminal runs", () => {
    expect(
      buildAirgapRunExportPayload({
        organizationId: "org_1",
        run: {
          id: "run_1",
          status: "running",
          environment: "prod",
          correlationId: "corr_1",
          errorSummary: null,
          startedAt: new Date(),
          finishedAt: null,
          ingestionExecutor: "customer_agent",
          telemetry: {},
          pipelineId: null,
          pipeline: null,
          dbtProject: null,
        },
      })
    ).toBeNull();
  });
});
