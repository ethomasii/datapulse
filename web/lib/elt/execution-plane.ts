import type { ExecutionPlane } from "@prisma/client";

/** Values we expose to the browser / public API (no legacy enum members). */
export type ExecutionPlanePublic = "customer_agent" | "eltpulse_managed";

export function normalizeExecutionPlane(plane: ExecutionPlane): ExecutionPlanePublic {
  if (plane === "eltpulse_managed" || plane === "datapulse_managed") return "eltpulse_managed";
  return "customer_agent";
}

export function isManagedExecutionPlane(plane: ExecutionPlane): boolean {
  return plane === "eltpulse_managed" || plane === "datapulse_managed";
}
