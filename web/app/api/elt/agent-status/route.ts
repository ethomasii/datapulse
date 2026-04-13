/**
 * GET /api/elt/agent-status
 *
 * Session — execution preference, named connectors + heartbeats, account-wide token summary.
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isManagedExecutionPlane, normalizeExecutionPlane } from "@/lib/elt/execution-plane";

export const dynamic = "force-dynamic";

function labelsFromJson(raw: unknown): Record<string, string> {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return {};
  const o: Record<string, string> = {};
  for (const [k, v] of Object.entries(raw as Record<string, unknown>)) {
    if (typeof v === "string") o[k] = v;
  }
  return o;
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const connectors = await db.agentToken.findMany({
    where: { userId: user.id, revokedAt: null },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      name: true,
      metadata: true,
      lastSeenAt: true,
      lastSeenVersion: true,
      lastSeenLabels: true,
      lastSeenSource: true,
      createdAt: true,
    },
  });

  const connectorPayload = connectors.map((c) => ({
    id: c.id,
    name: c.name,
    metadata: c.metadata,
    heartbeat: c.lastSeenAt
      ? {
          seenAt: c.lastSeenAt.toISOString(),
          version: c.lastSeenVersion ?? "unknown",
          labels: labelsFromJson(c.lastSeenLabels),
          source: c.lastSeenSource ?? "customer_agent",
        }
      : null,
    createdAt: c.createdAt.toISOString(),
  }));

  const accountTokenHb =
    user.agentLastSeenAt && user.agentToken
      ? {
          seenAt: user.agentLastSeenAt.toISOString(),
          version: user.agentLastSeenVersion ?? "unknown",
          labels: labelsFromJson(user.agentLastSeenLabels),
          source: user.agentLastSeenSource ?? "customer_agent",
        }
      : null;

  type Cand = { t: Date; kind: "connector" | "account"; hb: NonNullable<typeof accountTokenHb> };
  const candidates: Cand[] = [];
  for (const c of connectorPayload) {
    if (c.heartbeat) {
      candidates.push({ t: new Date(c.heartbeat.seenAt), kind: "connector", hb: c.heartbeat });
    }
  }
  if (accountTokenHb) {
    candidates.push({ t: new Date(accountTokenHb.seenAt), kind: "account", hb: accountTokenHb });
  }
  candidates.sort((a, b) => b.t.getTime() - a.t.getTime());
  const summaryHeartbeat = candidates[0]?.hb ?? null;

  const managedComputeReady = isManagedExecutionPlane(user.executionPlane);

  return NextResponse.json({
    executionPlane: normalizeExecutionPlane(user.executionPlane),
    managedComputeReady,
    hasAccountToken: Boolean(user.agentToken),
    hasNamedConnectors: connectors.length > 0,
    hasAnyToken: Boolean(user.agentToken) || connectors.length > 0,
    defaultAgentTokenId: user.defaultAgentTokenId,
    connectors: connectorPayload,
    accountTokenHeartbeat: accountTokenHb,
    heartbeat: summaryHeartbeat,
  });
}
