import { describe, expect, it } from "vitest";
import { generateDltPipeline } from "./generate-dlt";
import type { PipelineRequest } from "./types";

describe("refresh pipeline artifacts (github stale code guard)", () => {
  it("regenerated github code routes repo_events and stargazers to separate sources", () => {
    const code = generateDltPipeline({
      name: "github_to_motherduck",
      sourceType: "github",
      destinationType: "motherduck",
      sourceConfiguration: {
        repo_owner: "acme",
        repo_name: "widgets",
        resources: ["issues", "pull_requests", "repo_events", "stargazers"],
      },
      writeDisposition: "append",
      fileFormat: "parquet",
    } as PipelineRequest);
    expect(code).not.toContain("with_resources(*resources_to_load)");
    expect(code).toContain("github_repo_events(");
    expect(code).toContain("github_stargazers(**source_kwargs)");
  });
});
