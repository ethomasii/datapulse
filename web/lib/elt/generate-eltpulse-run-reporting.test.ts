import { describe, expect, it } from "vitest";
import { wrapDltPipelineCodeForLiveTelemetry } from "./generate-eltpulse-run-reporting";

describe("wrapDltPipelineCodeForLiveTelemetry", () => {
  it("wraps pipeline.run and injects live telemetry helpers", () => {
    const code = `"""pipeline"""
import dlt

def run():
    pipeline = dlt.pipeline("x", destination="motherduck")
    info = pipeline.run(source, write_disposition="append")
    return info
`;
    const out = wrapDltPipelineCodeForLiveTelemetry(code);
    expect(out).toContain("_eltpulse_run_pipeline(pipeline, source");
    expect(out).toContain("_eltpulse_patch_run");
    expect(out).toMatch(/info = _eltpulse_run_pipeline\(pipeline, source/);
  });

  it("is idempotent", () => {
    const code = `def run():\n    info = pipeline.run(source)\n`;
    const once = wrapDltPipelineCodeForLiveTelemetry(code);
    expect(wrapDltPipelineCodeForLiveTelemetry(once)).toBe(once);
  });

  it("leaves code without pipeline.run unchanged", () => {
    const code = `def run():\n    pass\n`;
    expect(wrapDltPipelineCodeForLiveTelemetry(code)).toBe(code);
  });
});
