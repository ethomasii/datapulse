/**
 * /api/agent/token
 *
 * GET  → { hasToken: boolean }
 * POST → generate (or rotate) token, returns token ONCE
 * DELETE → revoke token
 *
 * Requires a valid Clerk session (account owner manages their agent token).
 */
import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  return NextResponse.json({
    hasToken: Boolean(user.agentToken),
    executionPlane: user.executionPlane,
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
  await db.user.update({ where: { id: user.id }, data: { agentToken: null } });
  return NextResponse.json({ ok: true });
}
