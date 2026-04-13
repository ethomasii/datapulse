/**
 * GET /api/elt/account-execution — preferred ingestion plane + whether an agent token exists.
 * PATCH — set `executionPlane` (customer-operated vs eltPulse-managed when available).
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

const patchSchema = z.object({
  executionPlane: z.enum(["customer_agent", "datapulse_managed"]),
});

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  return NextResponse.json({
    executionPlane: user.executionPlane,
    hasAgentToken: Boolean(user.agentToken),
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

  return NextResponse.json({
    executionPlane: updated.executionPlane,
    hasAgentToken: Boolean(updated.agentToken),
  });
}
