/**
 * /api/agent/token
 *
 * GET  → { hasToken: boolean }
 * POST → generate (or rotate) token, returns token ONCE
 * DELETE → revoke token
 *
 * Requires a valid Clerk session (account owner manages the account-wide gateway token).
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { normalizeExecutionPlane } from "@/lib/elt/execution-plane";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const namedCount = await db.agentToken.count({
    where: { userId: user.id, revokedAt: null },
  });
  return NextResponse.json({
    hasToken: Boolean(user.agentToken) || namedCount > 0,
    accountToken: Boolean(user.agentToken),
    namedConnectorCount: namedCount,
    executionPlane: normalizeExecutionPlane(user.executionPlane),
  });
}

export async function POST() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  // Generate a 48-byte hex token (96 chars)
  const buf = new Uint8Array(48);
  crypto.getRandomValues(buf);
  const token = Array.from(buf).map((b) => b.toString(16).padStart(2, "0")).join("");

  await db.user.update({ where: { id: user.id }, data: { agentToken: token } });

  return NextResponse.json({ token });
}

export async function DELETE() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  await db.user.update({
    where: { id: user.id },
    data: {
      agentToken: null,
      agentLastSeenAt: null,
      agentLastSeenVersion: null,
      agentLastSeenLabels: {},
      agentLastSeenSource: null,
    },
  });
  return NextResponse.json({ ok: true });
}
