import { describe, expect, it } from "vitest";
import { generateDltPipeline } from "./generate-dlt";
import type { PipelineRequest } from "./types";

describe("generateDltPipeline github", () => {
  it("uses github_reactions only for issues and pull_requests", () => {
    const code = generateDltPipeline({
      name: "github_to_motherduck",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "acme",
        repo_name: "widgets",
        resources: ["issues", "pull_requests"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("from github import github_reactions, github_repo_events, github_stargazers");
    expect(code).toContain("github_reactions(**source_kwargs).with_resources(*reactions_resources)");
    expect(code).not.toContain("github_repo_events(");
    expect(code).not.toContain("github_stargazers(");
    expect(code).toContain("max_items=500");
  });

  it("defaults max_items to 500 when unset", () => {
    const code = generateDltPipeline({
      name: "github_sync",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "dlt-hub",
        repo_name: "dlt",
        resources: ["issues"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("max_items=500");
  });

  it("honors explicit max_items including 0 for unlimited", () => {
    const code = generateDltPipeline({
      name: "github_sync",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "dlt-hub",
        repo_name: "dlt",
        resources: ["issues"],
        max_items: 0,
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain("max_items=None");
  });

  it("runs separate verified sources for repo_events and stargazers", () => {
    const code = generateDltPipeline({
      name: "github_to_motherduck",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "acme",
        repo_name: "widgets",
        resources: ["issues", "repo_events", "stargazers"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain('reactions_resources = ["issues"]');
    expect(code).toContain("github_repo_events(");
    expect(code).toContain("github_stargazers(**source_kwargs)");
    expect(code).not.toContain("with_resources(*resources_to_load)");
  });

  it("drops unsupported resource ids from codegen", () => {
    const code = generateDltPipeline({
      name: "github_to_motherduck",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "acme",
        repo_name: "widgets",
        resources: ["commits", "workflows", "issues"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).toContain('reactions_resources = ["issues"]');
    expect(code).not.toContain("commits");
    expect(code).not.toContain("workflows");
  });

  it("wires partition_key to since/until for day slices and defaults merge", () => {
    const code = generateDltPipeline({
      name: "github_slice",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "dlt-hub",
        repo_name: "dlt",
        resources: ["issues"],
      },
    } as PipelineRequest);
    expect(code).toContain("if partition_key:");
    expect(code).toContain('source_kwargs["since"] = pk');
    expect(code).toContain("timedelta(days=1)");
    expect(code).toContain('write_disposition="merge"');
  });
});
