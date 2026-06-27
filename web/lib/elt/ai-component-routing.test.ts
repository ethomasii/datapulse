import { describe, expect, it } from "vitest";
import { matchAiComponentIntent } from "./ai-component-routing";

describe("matchAiComponentIntent", () => {
  it("routes structured extraction queries", () => {
    expect(matchAiComponentIntent("extract fields from email body as json")?.componentId).toBe(
      "litellm_structured_output"
    );
  });

  it("routes per-row agent queries", () => {
    expect(matchAiComponentIntent("run an mcp agent on each row")?.componentId).toBe("litellm_agent");
  });

  it("routes enrichment vs agent", () => {
    expect(matchAiComponentIntent("summarize each row with llm")?.componentId).toBe(
      "litellm_inference_asset"
    );
    expect(matchAiComponentIntent("llm agent with stripe tools")?.componentId).toBe("litellm_agent");
  });

  it("returns null for unrelated queries", () => {
    expect(matchAiComponentIntent("filter active users")).toBeNull();
  });
});
