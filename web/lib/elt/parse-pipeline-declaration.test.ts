import { describe, expect, it } from "vitest";
import { parsePipelineDeclarationYaml } from "./parse-pipeline-declaration";

describe("parsePipelineDeclarationYaml", () => {
  it("parses flat v1 declaration", () => {
    const y = `
eltpulse_pipeline_declaration: 1
name: pipe_a
sourceType: github
destinationType: snowflake
tool: dlt
sourceConfiguration:
  repo_owner: o
  repo_name: r
`;
    const { body, upsert } = parsePipelineDeclarationYaml(y);
    expect(body.name).toBe("pipe_a");
    expect(body.tool).toBe("dlt");
    expect(upsert).toBe(false);
  });

  it("reads upsert and nested pipeline", () => {
    const y = `
eltpulse_pipeline_declaration: 1
upsert: true
pipeline:
  name: pipe_b
  sourceType: rest_api
  destinationType: postgres
  sourceConfiguration:
    base_url: https://api.example.com
`;
    const { body, upsert } = parsePipelineDeclarationYaml(y);
    expect(body.name).toBe("pipe_b");
    expect(upsert).toBe(true);
  });
});
