import { describe, expect, it } from "vitest";
import { mergeEltMetadataIntoSourceConfig } from "./merge-elt-metadata";
import type { CreatePipelineBody } from "./types";

function baseBody(over: Partial<CreatePipelineBody> = {}): CreatePipelineBody {
  return {
    name: "p",
    sourceType: "github",
    destinationType: "duckdb",
    tool: "auto",
    sourceConfiguration: { repo_owner: "o", repo_name: "r" },
    ...over,
  };
}

describe("mergeEltMetadataIntoSourceConfig", () => {
  it("merges tests and sensors as line arrays", () => {
    const merged = mergeEltMetadataIntoSourceConfig(
      baseBody({
        tests: "a\nb",
        sensors: "s1",
      })
    );
    expect(merged.elt_tests).toEqual(["a", "b"]);
    expect(merged.elt_sensors).toEqual(["s1"]);
    expect(merged.repo_owner).toBe("o");
  });

  it("removes elt_tests when tests cleared", () => {
    const merged = mergeEltMetadataIntoSourceConfig(
      baseBody({
        sourceConfiguration: { elt_tests: ["x"] },
        tests: "",
      })
    );
    expect(merged.elt_tests).toBeUndefined();
  });

  it("does not touch elt_tests when tests field omitted", () => {
    const merged = mergeEltMetadataIntoSourceConfig(
      baseBody({
        sourceConfiguration: { elt_tests: ["keep"] },
      })
    );
    expect(merged.elt_tests).toEqual(["keep"]);
  });

  it("persists schedule fields", () => {
    const merged = mergeEltMetadataIntoSourceConfig(
      baseBody({
        scheduleEnabled: true,
        scheduleCron: "0 * * * *",
        scheduleTimezone: "America/New_York",
      })
    );
    expect(merged.schedule_enabled).toBe(true);
    expect(merged.cron_schedule).toBe("0 * * * *");
    expect(merged.schedule_timezone).toBe("America/New_York");
  });
});
