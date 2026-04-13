/**
 * Organization workspace (billing owner + org-scoped agent token).
 *
 * GET  — session: { organization, hasAgentToken } or null if no org
 * POST — session: create org for current user (one owned org per user); returns agent token once
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

function generateAgentToken(): string {
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  return Array.from(buf)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await db.organization.findUnique({
    where: { ownerUserId: user.id },
    select: {
      id: true,
      name: true,
      clerkOrgId: true,
      sensorPollIntervalSecondsOverride: true,
      agentToken: true,
      createdAt: true,
      updatedAt: true,
    },
  });

  if (!org) {
    return NextResponse.json({ organization: null });
  }

  return NextResponse.json({
    organization: {
      id: org.id,
      name: org.name,
      clerkOrgId: org.clerkOrgId,
      sensorPollIntervalSecondsOverride: org.sensorPollIntervalSecondsOverride,
      hasAgentToken: Boolean(org.agentToken),
      createdAt: org.createdAt,
      updatedAt: org.updatedAt,
    },
  });
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const existing = await db.organization.findUnique({
    where: { ownerUserId: user.id },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json(
      { error: "You already have an organization for this account." },
      { status: 409 }
    );
  }

  let name = "Organization";
  try {
    const body = (await req.json()) as { name?: string };
    if (typeof body.name === "string" && body.name.trim()) {
      name = body.name.trim().slice(0, 120);
    }
  } catch {
    /* optional body */
  }

  const agentToken = generateAgentToken();

  const org = await db.organization.create({
    data: {
      name,
      ownerUserId: user.id,
      agentToken,
    },
    select: { id: true, name: true },
  });

  return NextResponse.json({
    organization: org,
    agentToken,
    message:
      "Store this token securely. It authenticates the org agent to eltPulse (same endpoints as the personal agent token).",
  });
}
