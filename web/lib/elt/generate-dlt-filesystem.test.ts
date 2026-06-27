import { describe, expect, it } from "vitest";
import { generateDltPipeline } from "./generate-dlt";
import type { PipelineRequest } from "./types";

describe("generateDltPipeline filesystem", () => {
  it("generates S3 filesystem pipeline with partition prefix", () => {
    const code = generateDltPipeline({
      name: "s3_sync",
      sourceType: "s3",
      destinationType: "motherduck",
      sourceConfiguration: {
        bucket: "my-lake",
        prefix: "exports",
        file_format: "parquet",
      },
    } as PipelineRequest);
    expect(code).toContain("from dlt.sources.filesystem import filesystem, read_parquet");
    expect(code).toContain('base = "s3://" + bucket + "/"');
    expect(code).toContain("partition_key.strip()");
    expect(code).toContain("read_parquet(files)");
  });

  it("generates csv local glob with partition_key", () => {
    const code = generateDltPipeline({
      name: "csv_sync",
      sourceType: "csv",
      destinationType: "duckdb",
      sourceConfiguration: { file_path: "/data/incoming/report.csv" },
    } as PipelineRequest);
    expect(code).toContain('("*" + partition_key.strip() + "*.csv")');
  });
});

describe("generateDltPipeline hubspot slices", () => {
  it("wires hubspot since/until from partition_key", () => {
    const code = generateDltPipeline({
      name: "hubspot_crm",
      sourceType: "hubspot",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["contacts"] },
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain('source_kwargs["until"]');
  });
});

describe("generateDltPipeline rest advanced slices", () => {
  it("injects partition into advanced REST config", () => {
    const code = generateDltPipeline({
      name: "rest_adv",
      sourceType: "rest_api",
      destinationType: "motherduck",
      sourceConfiguration: {
        advanced_mode: true,
        advanced_config: JSON.stringify({
          client: { base_url: "https://api.example.com" },
          resources: [{ name: "items", endpoint: { path: "items", params: {} } }],
        }),
      },
    } as PipelineRequest);
    expect(code).toContain('params["since"] = pk');
    expect(code).toContain('inc["initial_value"] = pk');
  });
});

describe("generateDltPipeline postgres dlt slices", () => {
  it("sets sql_database incremental env when partition column saved", () => {
    const code = generateDltPipeline({
      name: "pg_sync",
      sourceType: "postgres",
      destinationType: "motherduck",
      sourceConfiguration: {
        schema: "public",
        tables: "users",
        _partitionConfig: { type: "date", column: "updated_at" },
      },
    } as PipelineRequest);
    expect(code).toContain('partition_column = "updated_at"');
    expect(code).toContain("SOURCES__SQL_DATABASE__");
  });
});

describe("generateDltPipeline context REST sources", () => {
  it("generates intercom REST pipeline with partition override", () => {
    const code = generateDltPipeline({
      name: "intercom_sync",
      sourceType: "intercom",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain("INTERCOM_ACCESS_TOKEN");
    expect(code).toContain("rest_api_source(config)");
    expect(code).toContain('inc["initial_value"] = pk');
  });

  it("generates mixpanel export with from_date when partition_key set", () => {
    const code = generateDltPipeline({
      name: "mixpanel_events",
      sourceType: "mixpanel",
      destinationType: "motherduck",
      sourceConfiguration: { project_id: "12345" },
    } as PipelineRequest);
    expect(code).toContain("MIXPANEL_API_SECRET");
    expect(code).toContain("data.mixpanel.com/api/2.0/export");
    expect(code).toContain("from_date = pk[:10]");
  });

  it("generates segment Config API pipeline", () => {
    const code = generateDltPipeline({
      name: "segment_catalog",
      sourceType: "segment",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain("SEGMENT_ACCESS_TOKEN");
    expect(code).toContain("api.segmentapis.com");
  });
});

describe("generateDltPipeline iceberg source", () => {
  it("generates pyiceberg scan pipeline with slice column", () => {
    const code = generateDltPipeline({
      name: "iceberg_sync",
      sourceType: "iceberg",
      destinationType: "motherduck",
      sourceConfiguration: {
        warehouse: "s3://lake/warehouse/",
        namespace: "analytics",
        table: "events",
        slice_column: "event_date",
      },
    } as PipelineRequest);
    expect(code).toContain("from pyiceberg.catalog import load_catalog");
    expect(code).toContain('slice_column = "event_date"');
    expect(code).toContain("row_filter");
  });
});
