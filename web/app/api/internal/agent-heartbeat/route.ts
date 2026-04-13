/**
 * POST /api/internal/agent-heartbeat
 *
 * eltPulse-operated workers (SaaS / dedicated “managed agent”) report liveness without the customer’s agent token.
 * Auth: `Authorization: Bearer ${ELTPULSE_INTERNAL_API_SECRET}` (set only in our deployment env).
 *
 * Body: { "userId": string, "version"?: string, "labels"?: Record<string, string> }
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  const secret = process.env.ELTPULSE_INTERNAL_API_SECRET;
  const auth = req.headers.get("authorization") ?? "";
  if (!secret || auth !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: { userId?: string; version?: string; labels?: Record<string, string> };
  try {
    body = (await req.json()) as typeof body;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const userId = typeof body.userId === "string" ? body.userId.trim() : "";
  if (!userId) {
    return NextResponse.json({ error: "userId is required" }, { status: 400 });
  }

  const version = typeof body.version === "string" ? body.version : "eltpulse-managed";
  const rawLabels = body.labels;
  const labels: Record<string, string> =
    rawLabels && typeof rawLabels === "object" && !Array.isArray(rawLabels)
      ? Object.fromEntries(
          Object.entries(rawLabels).filter(([, v]) => typeof v === "string") as [string, string][]
        )
      : {};

  const mergedLabels: Prisma.InputJsonValue = {
    ...labels,
    executor: "eltpulse_managed",
  };

  const updated = await db.user.update({
    where: { id: userId },
    data: {
      agentLastSeenAt: new Date(),
      agentLastSeenVersion: version,
      agentLastSeenLabels: mergedLabels,
      agentLastSeenSource: "eltpulse_managed",
    },
    select: { id: true },
  });

  return NextResponse.json({ ok: true, userId: updated.id, seenAt: new Date().toISOString() });
}
