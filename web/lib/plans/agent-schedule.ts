import type { PlanTier } from "@prisma/client";

/**
 * Control-plane defaults for the self-hosted agent. The agent should poll
 * `GET /api/agent/manifest` and honor these intervals — no static config required.
 *
 * Tier → minimum time between sensor/monitor evaluations (cloud cron uses the same floor).
 */
export function sensorCheckIntervalSecondsForTier(tier: PlanTier): number {
  switch (tier) {
    case "team":
      return 60;
    case "pro":
      return 300;
    case "free":
    default:
      return 600;
  }
}

/** How often the agent should poll for pending pipeline runs. */
export const RUNS_POLL_INTERVAL_SECONDS = 5;

/** Suggested heartbeat interval for `POST /api/agent/heartbeat`. */
export const HEARTBEAT_INTERVAL_SECONDS = 30;

/** Manifest schema version — bump when response shape changes. */
export const AGENT_MANIFEST_VERSION = 1;

/**
 * Org-level override (e.g. enterprise) wins over tier when set and ≥ 30s.
 */
export function resolveSensorCheckIntervalSeconds(args: {
  planTier: PlanTier;
  organizationSensorOverride: number | null | undefined;
}): number {
  const o = args.organizationSensorOverride;
  if (o != null && Number.isFinite(o) && o >= 30) {
    return Math.floor(o);
  }
  return sensorCheckIntervalSecondsForTier(args.planTier);
}
