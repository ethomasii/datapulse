import { describe, expect, it } from "vitest";
import {
  enrichComponentListAssets,
  deriveStepAssetKey,
  inputPreviewSourcesFromConfig,
} from "@/lib/elt/pipeline-asset-keys";
import { buildCanvasFromDeclarativeSpec } from "@/lib/elt/spec-components-to-canvas";

describe("pipeline-asset-keys", () => {
  it("exposes left and right inputs for join config", () => {
    const sources = inputPreviewSourcesFromConfig({
      left_table: "staging.orders",
      right_table: "staging.customers",
      output_table: "staging.enriched",
    });
    expect(sources).toHaveLength(2);
    expect(sources[0]?.table).toBe("staging.orders");
    expect(sources[1]?.table).toBe("staging.customers");
  });

  it("derives asset key from output_table", () => {
    const key = deriveStepAssetKey("orders_pipeline", "join_step", {
      output_table: "staging.orders_enriched",
    });
    expect(key).toBe("staging.orders_enriched");
  });

  it("chains inputs via after deps", () => {
    const enriched = enrichComponentListAssets("p", [
      {
        id: "join_step",
        type: "python",
        config: { template_id: "join_tables", output_table: "staging.joined" },
      },
      {
        id: "filter_step",
        type: "python",
        config: { template_id: "filter_rows", table: "staging.joined", output_table: "staging.active" },
        after: ["join_step"],
      },
    ]);
    expect(enriched[0]?.assetKey).toBe("staging.joined");
    expect(enriched[1]?.inputs).toContain("staging.joined");
  });
});

describe("spec-components-to-canvas round-trip", () => {
  it("builds backbone + component nodes from declarative spec", () => {
    const canvas = buildCanvasFromDeclarativeSpec(
      {
        name: "demo",
        source: "github",
        destination: "duckdb",
        tool: "dlt",
        components: [
          {
            id: "filter_step",
            type: "python",
            assetKey: "staging.filtered",
            config: { template_id: "filter_rows", table: "staging.raw", condition: "x > 0" },
          },
        ],
      },
      "github",
      "duckdb"
    );
    expect(canvas.nodes.some((n) => n.type === "sourceNode")).toBe(true);
    expect(canvas.nodes.some((n) => n.type === "destNode")).toBe(true);
    expect(canvas.nodes.some((n) => n.type === "componentNode")).toBe(true);
    expect(canvas.edges.length).toBeGreaterThan(1);
  });
});
