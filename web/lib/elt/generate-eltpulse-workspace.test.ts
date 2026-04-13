import { describe, expect, it } from "vitest";
import { generateEltpulseWorkspaceYaml } from "./generate-eltpulse-workspace";
import type { PipelineRequest } from "./types";

const minimal: PipelineRequest = {
  name: "my_pipeline",
  sourceType: "github",
  destinationType: "duckdb",
  sourceConfiguration: {},
};

describe("generateEltpulseWorkspaceYaml", () => {
  it("includes quality.tests and triggers when set", () => {
    const yaml = generateEltpulseWorkspaceYaml({
      ...minimal,
      tests: ["row_count > 0"],
      sensors: ["new object in bucket"],
      partitionsNote: "daily by ds",
      otherNotes: "owner: #data",
    });
    expect(yaml).toContain("quality:");
    expect(yaml).toContain("row_count > 0");
    expect(yaml).toContain("triggers:");
    expect(yaml).toContain("partitions_note:");
    expect(yaml).toContain("daily by ds");
    expect(yaml).toContain("other_notes:");
  });

  it("omits empty quality/triggers", () => {
    const yaml = generateEltpulseWorkspaceYaml(minimal);
    expect(yaml).not.toMatch(/^\s*quality:/m);
    expect(yaml).not.toMatch(/^\s*triggers:/m);
  });

  it("uses eltpulse workspace keys", () => {
    const yaml = generateEltpulseWorkspaceYaml(minimal);
    expect(yaml).toContain("eltpulse_version:");
    expect(yaml).toMatch(/engine:\s*eltpulse/);
    expect(yaml).toContain("eltpulse.pipelines.my_pipeline");
  });
});
