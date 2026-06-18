import { describe, expect, it } from "vitest";
import {
  pivotComponent,
  dataCleansingComponent,
  antiJoinComponent,
} from "@/lib/elt/native-components/definitions/analytics-transforms";
import { getNativeComponent } from "@/lib/elt/native-components/registry";
import { wrapStepPythonBlocks } from "@/lib/elt/run-step-python";
import { matchPlaybook } from "@/lib/elt/ai-pipeline-playbook";

describe("analytics-transforms natives", () => {
  it("pivot compiles python", () => {
    const out = pivotComponent.compile({
      table: "staging.events",
      index: ["date"],
      columns: "category",
      values: "amount",
      output_table: "staging.pivot",
    });
    expect(out.python?.length).toBeGreaterThan(0);
  });

  it("data_cleansing compiles", () => {
    const out = dataCleansingComponent.compile({
      table: "raw.users",
      string_columns: ["email"],
      output_table: "staging.users",
    });
    expect(out.python?.some((l) => l.includes("str.strip"))).toBe(true);
  });

  it("lookup resolves to join_tables native", () => {
    expect(getNativeComponent("lookup")?.id).toBe("join_tables");
  });

  it("anti_join compiles", () => {
    const out = antiJoinComponent.compile({
      left_table: "a.t",
      right_table: "b.t",
      on: ["id"],
      output_table: "staging.orphans",
    });
    expect(out.python?.some((l) => l.includes("left_only"))).toBe(true);
  });
});

describe("run-step-python", () => {
  it("wraps pipeline shim", () => {
    const script = wrapStepPythonBlocks(["print('ok')"]);
    expect(script).toContain("pipeline = _PipelineShim()");
    expect(script).toContain("ELTPULSE_STEP_ENGINE_URL");
  });
});

describe("ai-pipeline-playbook", () => {
  it("matches clean data playbook", () => {
    expect(matchPlaybook("clean data and parse dates")?.id).toBe("clean_and_parse");
  });
});
