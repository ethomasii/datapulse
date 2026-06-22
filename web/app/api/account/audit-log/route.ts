import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { listWorkspaceAuditEvents } from "@/lib/audit/workspace-audit";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const events = await listWorkspaceAuditEvents(user.id);
  return NextResponse.json({
    events,
    migrationPending: events.length === 0,
  });
}
