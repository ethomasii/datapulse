/**
 * GET /api/elt/account-execution — preferred ingestion plane + whether a gateway token exists.
 * PATCH — set `executionPlane` (your infrastructure vs eltPulse-managed).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { isManagedExecutionPlane, normalizeExecutionPlane } from "@/lib/elt/execution-plane";

const patchSchema = z.object({
  executionPlane: z.enum(["customer_agent", "eltpulse_managed"]),
});

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const namedCount = await db.agentToken.count({
    where: { userId: user.id, revokedAt: null },
  });
  const managedComputeReady = isManagedExecutionPlane(user.executionPlane);

  return NextResponse.json({
    executionPlane: normalizeExecutionPlane(user.executionPlane),
    hasAgentToken: Boolean(user.agentToken) || namedCount > 0,
    namedConnectorCount: namedCount,
    managedComputeReady,
  });
}

export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { executionPlane: parsed.data.executionPlane },
    select: { executionPlane: true, agentToken: true },
  });

  const namedCount = await db.agentToken.count({
    where: { userId: user.id, revokedAt: null },
  });
  const managedComputeReady = isManagedExecutionPlane(updated.executionPlane);

  return NextResponse.json({
    executionPlane: normalizeExecutionPlane(updated.executionPlane),
    hasAgentToken: Boolean(updated.agentToken) || namedCount > 0,
    namedConnectorCount: namedCount,
    managedComputeReady,
  });
}
