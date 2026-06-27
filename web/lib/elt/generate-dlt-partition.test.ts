import { describe, expect, it } from "vitest";
import { generateVerifiedSourcePipeline } from "./generate-dlt-verified";
import type { PipelineRequest } from "./types";

describe("verified source run slice codegen", () => {
  it("wires slack start_date and end_date from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "slack_sync",
      sourceType: "slack",
      destinationType: "motherduck",
      sourceConfiguration: {},
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["start_date"] = pk');
    expect(code).toContain('source_kwargs["end_date"]');
    expect(code).toContain("timedelta(days=1)");
  });

  it("uses jira_search JQL when partition_key is set", () => {
    const code = generateVerifiedSourcePipeline({
      name: "jira_sync",
      sourceType: "jira",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["issues"] },
    } as PipelineRequest);
    expect(code).toContain("from jira import jira, jira_search");
    expect(code).toContain("jira_search(**source_kwargs).issues([jql])");
    expect(code).toContain('updated >= "');
  });

  it("sets asana tasks incremental env from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "asana_sync",
      sourceType: "asana",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain('"tasks", "modified_at"');
    expect(code).toContain('SOURCES__ASANA_DLT__" + _res.upper() + "__" + _cursor.upper() + "__');
  });

  it("sets salesforce incremental env from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "sf_sync",
      sourceType: "salesforce",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["account"] },
    } as PipelineRequest);
    expect(code).toContain('"account", "LastModifiedDate"');
    expect(code).toContain('"opportunity", "SystemModstamp"');
    expect(code).toContain('SOURCES__SALESFORCE__" + _res.upper() + "__" + _cursor.upper() + "__');
  });

  it("wires notion since/until from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "notion_sync",
      sourceType: "notion",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain('source_kwargs["until"]');
  });

  it("wires airtable since/until from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "airtable_sync",
      sourceType: "airtable",
      destinationType: "motherduck",
      sourceConfiguration: { base_id: "appXXX" },
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain('source_kwargs["until"]');
  });

  it("wires pipedrive since_timestamp from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "pd_sync",
      sourceType: "pipedrive",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since_timestamp"] = pk');
  });

  it("wires matomo visits incremental env from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "matomo_sync",
      sourceType: "matomo",
      destinationType: "motherduck",
      sourceConfiguration: { site_id: "1" },
    } as PipelineRequest);
    expect(code).toContain('"visits", "serverTimestamp"');
    expect(code).toContain("SOURCES__MATOMO_VISITS__");
  });

  it("wires facebook insights incremental env from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "fb_sync",
      sourceType: "facebook_ads",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain("facebook_insights_source");
    expect(code).toContain('"facebook_insights", "date_start"');
    expect(code).toContain("SOURCES__FACEBOOK_ADS__");
  });

  it("wires workable start_date from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "workable_sync",
      sourceType: "workable",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["start_date"] = pk');
  });

  it("wires freshdesk since/until from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "freshdesk_sync",
      sourceType: "freshdesk",
      destinationType: "motherduck",
      sourceConfiguration: { endpoints: ["tickets"] },
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain('source_kwargs["until"]');
    expect(code).toContain("with_resources");
  });

  it("sets personio incremental env bounds from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "personio_sync",
      sourceType: "personio",
      destinationType: "motherduck",
      sourceConfiguration: {},
    } as PipelineRequest);
    expect(code).toContain('"employees", "last_modified_at"');
    expect(code).toContain('SOURCES__PERSONIO__" + _res.upper()');
    expect(code).toContain('"START_DATE", pk[:10]');
  });

  it("wires strapi since/until from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "strapi_sync",
      sourceType: "strapi",
      destinationType: "motherduck",
      sourceConfiguration: { endpoints: ["articles"] },
    } as PipelineRequest);
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain('source_kwargs["until"]');
  });
});
