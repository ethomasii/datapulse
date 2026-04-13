/**
 * GET /api/elt/agent-status
 *
 * Session — execution preference, named connectors + heartbeats, account-wide token summary.
 */
import { NextResponse } from "next/server";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isManagedExecutionPlane, normalizeExecutionPlane } from "@/lib/elt/execution-plane";
import { tierAllowsOrgGatewayTokens } from "@/lib/plans/org-gateway-tier";

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
    where: { userId: user.id, organizationId: null, revokedAt: null },
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

  const sessionOrg = await getActiveOrganizationForSession();
  let organizationPayload: {
    id: string;
    name: string;
    defaultAgentTokenId: string | null;
    orgGatewaysAllowed: boolean;
    connectors: typeof connectorPayload;
  } | null = null;

  if (sessionOrg) {
    const org = await db.organization.findFirst({
      where: {
        id: sessionOrg.id,
        OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
      },
      select: {
        id: true,
        name: true,
        defaultAgentTokenId: true,
        orgScopedAgentTokens: {
          where: { revokedAt: null },
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
        },
        owner: { select: { subscription: { select: { tier: true } } } },
      },
    });
    if (org) {
      const tier = org.owner.subscription?.tier ?? "free";
      organizationPayload = {
        id: org.id,
        name: org.name,
        defaultAgentTokenId: org.defaultAgentTokenId,
        orgGatewaysAllowed: tierAllowsOrgGatewayTokens(tier),
        connectors: org.orgScopedAgentTokens.map((c) => ({
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
        })),
      };
    }
  }

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
  if (organizationPayload) {
    for (const c of organizationPayload.connectors) {
      if (c.heartbeat) {
        candidates.push({ t: new Date(c.heartbeat.seenAt), kind: "connector", hb: c.heartbeat });
      }
    }
  }
  if (accountTokenHb) {
    candidates.push({ t: new Date(accountTokenHb.seenAt), kind: "account", hb: accountTokenHb });
  }
  candidates.sort((a, b) => b.t.getTime() - a.t.getTime());
  const summaryHeartbeat = candidates[0]?.hb ?? null;

  const managedComputeReady = isManagedExecutionPlane(user.executionPlane);

  const orgConnectorCount = organizationPayload?.connectors.length ?? 0;
  const hasNamedConnectors = connectors.length > 0 || orgConnectorCount > 0;
  const hasAnyToken = Boolean(user.agentToken) || hasNamedConnectors;

  return NextResponse.json({
    executionPlane: normalizeExecutionPlane(user.executionPlane),
    managedComputeReady,
    hasAccountToken: Boolean(user.agentToken),
    hasNamedConnectors,
    hasAnyToken,
    defaultAgentTokenId: user.defaultAgentTokenId,
    connectors: connectorPayload,
    organization: organizationPayload,
    accountTokenHeartbeat: accountTokenHb,
    heartbeat: summaryHeartbeat,
  });
}
