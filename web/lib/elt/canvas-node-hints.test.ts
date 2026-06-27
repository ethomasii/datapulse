import { describe, expect, it } from "vitest";
import { displayConnectorNodeHint, isRedundantConnectorHint } from "@/lib/elt/canvas-node-hints";

describe("isRedundantConnectorHint", () => {
  it("detects Source: slug hints", () => {
    expect(isRedundantConnectorHint("source", "Source: github", "github")).toBe(true);
    expect(isRedundantConnectorHint("source", "Source: GitHub", "github")).toBe(true);
  });

  it("detects Destination: slug hints", () => {
    expect(isRedundantConnectorHint("destination", "Destination: motherduck", "motherduck")).toBe(true);
  });

  it("detects legacy extract/load hints", () => {
    expect(isRedundantConnectorHint("source", "github extract", "github")).toBe(true);
    expect(isRedundantConnectorHint("destination", "motherduck load", "motherduck")).toBe(true);
  });

  it("keeps real user notes", () => {
    expect(isRedundantConnectorHint("source", "Prod org — billing API", "github")).toBe(false);
  });
});

describe("displayConnectorNodeHint", () => {
  it("hides redundant hints", () => {
    expect(displayConnectorNodeHint("source", "Source: github", "github")).toBe("");
  });

  it("passes through custom notes", () => {
    expect(displayConnectorNodeHint("destination", "Staging warehouse", "motherduck")).toBe("Staging warehouse");
  });
});
