import type { PipelineRequest } from "./types";

/** Minimal pipeline stub — warehouse native transforms run via run-step / future executor. */
export function generateTransformOnlyPipeline(req: PipelineRequest): string {
  return `#!/usr/bin/env python3
"""Transform-only warehouse pipeline (no extract/load). Managed by eltPulse."""
# destination: ${req.destinationType}
# input tables: defined on canvas transform steps (joins, filters, etc.)
print("[eltpulse] transform-only pipeline — run native warehouse steps from the canvas designer.")
`;
}
