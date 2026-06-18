import { describe, expect, it } from "vitest";
import { enrichDbtManifestFromArtifact, parseDbtRunArtifacts } from "./dbt-artifact-manifest";

describe("parseDbtRunArtifacts", () => {
  it("parses run results and enriches from manifest nodes", () => {
    const runResults = {
      results: [
        { unique_id: "model.my_project.stg_customers", status: "success", execution_time: 1.2 },
      ],
    };
    const manifest = {
      nodes: {
        "model.my_project.stg_customers": {
          name: "stg_customers",
          description: "Staging customers from Stripe",
          columns: {
            id: { name: "id", data_type: "varchar", description: "Customer id" },
          },
        },
      },
    };
    const out = parseDbtRunArtifacts(runResults, manifest);
    expect(out?.models[0]?.name).toBe("stg_customers");
    expect(out?.models[0]?.description).toContain("Staging customers");
    expect(out?.models[0]?.columns?.[0]?.name).toBe("id");
  });
});

describe("enrichDbtManifestFromArtifact", () => {
  it("merges column metadata without overwriting existing", () => {
    const base = {
      models: [{ name: "stg_customers", status: "success" as const, columns: [{ name: "existing" }] }],
      tests: [],
    };
    const enriched = enrichDbtManifestFromArtifact(base, {
      nodes: {
        n: {
          name: "stg_customers",
          description: "From manifest",
          columns: { id: { name: "id", data_type: "text" } },
        },
      },
    });
    expect(enriched.models[0]?.columns?.[0]?.name).toBe("existing");
    expect(enriched.models[0]?.description).toBe("From manifest");
  });
});
