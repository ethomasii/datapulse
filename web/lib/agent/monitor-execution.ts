import type { ExecutionPlane, PipelineExecutionHost } from "@prisma/client";
import { isManagedExecutionPlane } from "@/lib/elt/execution-plane";

/**
 * When true, the control plane cron (and “Run checks” in the app) evaluates this monitor.
 * When false, only a customer gateway should evaluate and POST /api/agent/monitors/:id/report.
 */
export function monitorEvaluatesOnControlPlane(
  executionHost: PipelineExecutionHost,
  userExecutionPlane: ExecutionPlane
): boolean {
  if (executionHost === "eltpulse_managed") return true;
  if (executionHost === "customer_gateway") return false;
  return isManagedExecutionPlane(userExecutionPlane);
}
