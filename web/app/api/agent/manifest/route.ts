/**
 * GET /api/agent/manifest
 *
 * Single control-plane snapshot: poll intervals (from plan tier + optional org override),
 * pipeline and monitor workload IDs — agent needs only the bearer token.
 */
import { NextResponse } from "next/server";
import { getAgentAuthContext } from "@/lib/agent/auth";
import { db } from "@/lib/db/client";
import { parseExecutorHintsFromAgentTokenMetadata } from "@/lib/agent/executor-hints";
import {
  AGENT_MANIFEST_VERSION,
  HEARTBEAT_INTERVAL_SECONDS,
  RUNS_POLL_INTERVAL_SECONDS,
  resolveSensorCheckIntervalSeconds,
} from "@/lib/plans/agent-schedule";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const ownedOrg = await db.organization.findUnique({
    where: { ownerUserId: ctx.user.id },
    select: { id: true, name: true, sensorPollIntervalSecondsOverride: true },
  });

  const sensorCheckIntervalSeconds = resolveSensorCheckIntervalSeconds({
    planTier: ctx.planTier,
    organizationSensorOverride:
      ctx.organization?.sensorPollIntervalSecondsOverride ?? ownedOrg?.sensorPollIntervalSecondsOverride,
  });

  const [pipelines, monitors] = await Promise.all([
    db.eltPipeline.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        name: true,
        tool: true,
        enabled: true,
        sourceType: true,
        destinationType: true,
        groupName: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    }),
    db.eltMonitor.findMany({
      where: { userId: ctx.user.id },
      select: {
        id: true,
        name: true,
        type: true,
        pipelineId: true,
        pipeline: { select: { name: true } },
        config: true,
        connectionId: true,
        executionHost: true,
        lastCheckAt: true,
        lastTriggeredAt: true,
        updatedAt: true,
      },
      orderBy: { name: "asc" },
    }),
  ]);

  const base =
    process.env.NEXT_PUBLIC_APP_URL?.replace(/\/$/, "") ||
    new URL(req.url).origin;

  const organizationPayload =
    ctx.organization != null
      ? { id: ctx.organization.id, name: ctx.organization.name }
      : ownedOrg != null
        ? { id: ownedOrg.id, name: ownedOrg.name }
        : null;

  const executorHints = ctx.agentTokenRow
    ? parseExecutorHintsFromAgentTokenMetadata(ctx.agentTokenRow.metadata)
    : { pipelineRunIsolation: "inline" as const, monitorCheckIsolation: "inline" as const };

  return NextResponse.json({
    version: AGENT_MANIFEST_VERSION,
    controlPlane: {
      baseUrl: base,
    },
    executorHints,
    billing: {
      planTier: ctx.planTier,
      executionPlane: ctx.user.executionPlane,
      sensorCheckIntervalSeconds,
      runsPollIntervalSeconds: RUNS_POLL_INTERVAL_SECONDS,
      heartbeatIntervalSeconds: HEARTBEAT_INTERVAL_SECONDS,
    },
    organization: organizationPayload,
    workloads: {
      pipelines,
      monitors: monitors.map((m) => ({
        id: m.id,
        name: m.name,
        type: m.type,
        pipelineId: m.pipelineId,
        pipelineName: m.pipeline.name,
        config: m.config,
        connectionId: m.connectionId,
        executionHost: m.executionHost,
        lastCheckAt: m.lastCheckAt,
        lastTriggeredAt: m.lastTriggeredAt,
        updatedAt: m.updatedAt,
      })),
    },
  });
}
