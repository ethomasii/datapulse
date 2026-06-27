import { describe, expect, it } from "vitest";
import {
  filterCanvasOperatorPaletteSections,
  groupCanvasOperatorPalette,
} from "@/lib/elt/canvas-operator-palette-groups";
import type { ComponentListItem } from "@/components/elt/component-palette";

function item(id: string, category = "transformation"): ComponentListItem {
  return {
    id,
    name: id.replace(/_/g, " "),
    category,
    description: "",
    compileTarget: "warehouse",
    compileHint: "",
    canvasPorts: { left: true, right: true },
  };
}

describe("groupCanvasOperatorPalette", () => {
  it("groups known transforms and lists all items", () => {
    const transforms = [
      item("join_tables"),
      item("filter_rows"),
      item("select_columns"),
      item("pivot"),
      item("custom_package_step"),
    ];
    const ai = [item("litellm_agent", "ai")];
    const sections = groupCanvasOperatorPalette(transforms, ai);

    const allIds = sections.flatMap((s) => s.items.map((c) => c.id));
    expect(allIds).toContain("join_tables");
    expect(allIds).toContain("filter_rows");
    expect(allIds).toContain("pivot");
    expect(allIds).toContain("custom_package_step");
    expect(allIds).toContain("litellm_agent");
    expect(allIds.length).toBe(6);

    const combine = sections.find((s) => s.id === "combine");
    expect(combine?.items.some((c) => c.id === "join_tables")).toBe(true);
  });

  it("filters sections by search query", () => {
    const sections = groupCanvasOperatorPalette([item("join_tables"), item("filter_rows")], []);
    const filtered = filterCanvasOperatorPaletteSections(sections, "join");
    expect(filtered.length).toBe(1);
    expect(filtered[0]?.items.every((c) => c.id.includes("join"))).toBe(true);
  });

  it("separates MCP virtual tools into their own section", () => {
    const ai = [
      item("litellm_agent", "ai"),
      {
        ...item("mcp_virtual:s1:create_refund", "ai"),
        isMcpVirtual: true,
        name: "Stripe · create_refund",
      },
    ];
    const sections = groupCanvasOperatorPalette([], ai);
    expect(sections.find((s) => s.id === "ai")?.items.map((c) => c.id)).toEqual(["litellm_agent"]);
    expect(sections.find((s) => s.id === "mcp_tools")?.items.map((c) => c.id)).toEqual([
      "mcp_virtual:s1:create_refund",
    ]);
  });
});
