/**
 * POST /api/agent/heartbeat
 *
 * Agent sends this every ~30s so the UI can show "last seen".
 * Body: { version?: string, labels?: Record<string, string> }
 * Stores the timestamp in a lightweight in-memory cache (good enough until
 * we add an Agent model to the DB).
 *
 * Authenticated by Bearer agentToken.
 */
import { NextResponse } from "next/server";
import { getUserFromAgentToken } from "@/lib/agent/auth";

// Simple in-process cache: userId → { seenAt, version, labels }
// Resets on server restart, which is fine for a heartbeat indicator.
const HEARTBEATS = new Map<string, { seenAt: string; version: string; labels: Record<string, string> }>();

export async function POST(req: Request) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown> = {};
  try {
    body = await req.json();
  } catch { /* optional body */ }

  HEARTBEATS.set(user.id, {
    seenAt: new Date().toISOString(),
    version: typeof body.version === "string" ? body.version : "unknown",
    labels: (typeof body.labels === "object" && body.labels && !Array.isArray(body.labels))
      ? body.labels as Record<string, string>
      : {},
  });

  return NextResponse.json({ ok: true, seenAt: HEARTBEATS.get(user.id)!.seenAt });
}

export async function GET(req: Request) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const hb = HEARTBEATS.get(user.id) ?? null;
  return NextResponse.json({ heartbeat: hb });
}

