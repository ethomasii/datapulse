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
    expect(code).toContain("SOURCES__ASANA_DLT__TASKS__MODIFIED_AT__INITIAL_VALUE");
    expect(code).toContain("SOURCES__ASANA_DLT__TASKS__MODIFIED_AT__END_VALUE");
  });

  it("sets salesforce incremental env from partition_key", () => {
    const code = generateVerifiedSourcePipeline({
      name: "sf_sync",
      sourceType: "salesforce",
      destinationType: "motherduck",
      sourceConfiguration: { resources: ["account"] },
    } as PipelineRequest);
    expect(code).toContain('"SOURCES__SALESFORCE__" + _res.upper() + "__LAST_TIMESTAMP__"');
    expect(code).toContain('"account", "opportunity"');
  });
});
