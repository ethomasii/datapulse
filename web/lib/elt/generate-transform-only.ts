import type { PipelineRequest } from "./types";

/** Minimal pipeline stub — warehouse native transforms run via run-step / future executor. */
export function generateTransformOnlyPipeline(req: PipelineRequest): string {
  const table = String(
    (req.sourceConfiguration as Record<string, unknown> | undefined)?.source_table ?? "staging.events"
  );
  return `#!/usr/bin/env python3
"""Transform-only warehouse pipeline (no extract/load). Managed by eltPulse."""
# source_table: ${table}
# destination: ${req.destinationType}
print("[eltpulse] transform-only pipeline — run native warehouse steps from the canvas designer.")
`;
}
