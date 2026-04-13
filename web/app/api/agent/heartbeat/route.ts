/**
 * POST /api/agent/heartbeat
 *
 * Bearer: named `AgentToken`, account-wide `User.agentToken`, or org `Organization.agentToken`.
 * Persists per-connector when using named tokens; account-wide / org tokens still update owner `User` rollup.
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getAgentAuthContext } from "@/lib/agent/auth";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch {
    /* optional body */
  }

  const version = typeof body.version === "string" ? body.version : "unknown";
  const rawLabels = body.labels;
  const labels: Record<string, string> =
    rawLabels && typeof rawLabels === "object" && rawLabels !== null && !Array.isArray(rawLabels)
      ? Object.fromEntries(
          Object.entries(rawLabels as Record<string, unknown>).filter(([, v]) => typeof v === "string") as [
            string,
            string,
          ][]
        )
      : {};

  const mergedLabels: Prisma.InputJsonValue = {
    ...labels,
    executor: "customer_agent",
  };

  const seenAt = new Date();

  if (ctx.agentTokenRow) {
    await db.agentToken.update({
      where: { id: ctx.agentTokenRow.id },
      data: {
        lastSeenAt: seenAt,
        lastSeenVersion: version,
        lastSeenLabels: mergedLabels,
        lastSeenSource: "customer_agent",
      },
    });
  } else {
    await db.user.update({
      where: { id: ctx.user.id },
      data: {
        agentLastSeenAt: seenAt,
        agentLastSeenVersion: version,
        agentLastSeenLabels: mergedLabels,
        agentLastSeenSource: "customer_agent",
      },
    });
  }

  return NextResponse.json({ ok: true, seenAt: seenAt.toISOString() });
}

export async function GET(req: Request) {
  const ctx = await getAgentAuthContext(req);
  if (!ctx) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (ctx.agentTokenRow) {
    const row = await db.agentToken.findUnique({
      where: { id: ctx.agentTokenRow.id },
      select: {
        lastSeenAt: true,
        lastSeenVersion: true,
        lastSeenLabels: true,
        lastSeenSource: true,
        name: true,
        id: true,
      },
    });
    if (!row?.lastSeenAt) {
      return NextResponse.json({ heartbeat: null, connectorId: row?.id, connectorName: row?.name });
    }
    const lab =
      row.lastSeenLabels && typeof row.lastSeenLabels === "object" && !Array.isArray(row.lastSeenLabels)
        ? (row.lastSeenLabels as Record<string, string>)
        : {};
    return NextResponse.json({
      connectorId: row.id,
      connectorName: row.name,
      heartbeat: {
        seenAt: row.lastSeenAt.toISOString(),
        version: row.lastSeenVersion ?? "unknown",
        labels: lab,
        source: row.lastSeenSource ?? "customer_agent",
      },
    });
  }

  const row = await db.user.findUnique({
    where: { id: ctx.user.id },
    select: {
      agentLastSeenAt: true,
      agentLastSeenVersion: true,
      agentLastSeenLabels: true,
      agentLastSeenSource: true,
    },
  });

  if (!row?.agentLastSeenAt) {
    return NextResponse.json({ heartbeat: null });
  }

  const labels =
    row.agentLastSeenLabels &&
    typeof row.agentLastSeenLabels === "object" &&
    !Array.isArray(row.agentLastSeenLabels)
      ? (row.agentLastSeenLabels as Record<string, string>)
      : {};

  return NextResponse.json({
    heartbeat: {
      seenAt: row.agentLastSeenAt.toISOString(),
      version: row.agentLastSeenVersion ?? "unknown",
      labels,
      source: row.agentLastSeenSource ?? "customer_agent",
    },
  });
}
