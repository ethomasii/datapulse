import { describe, expect, it } from "vitest";
import { generateVerifiedSourcePipeline } from "./generate-dlt-verified";
import type { PipelineRequest } from "./types";

describe("generateVerifiedSourcePipeline", () => {
  it("emits verified import for hubspot", () => {
    const code = generateVerifiedSourcePipeline({
      name: "hubspot_crm",
      sourceType: "hubspot",
      destinationType: "motherduck",
      sourceConfiguration: { start_date: "2024-01-01" },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from hubspot import hubspot");
    expect(code).toContain("HUBSPOT_API_KEY");
    expect(code).toContain("api_key=_cred_0");
  });

  it("emits verified import for pipedrive", () => {
    const code = generateVerifiedSourcePipeline({
      name: "pd_deals",
      sourceType: "pipedrive",
      destinationType: "duckdb",
      sourceConfiguration: {},
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from pipedrive import pipedrive_source");
    expect(code).toContain("pipedrive_api_key=_cred_0");
  });
});
