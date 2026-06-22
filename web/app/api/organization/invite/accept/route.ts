import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { acceptInviteById } from "@/lib/organization/invites";

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { inviteId?: string } = {};
  try {
    body = (await req.json()) as { inviteId?: string };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const inviteId = typeof body.inviteId === "string" ? body.inviteId.trim() : "";
  if (!inviteId) {
    return NextResponse.json({ error: "inviteId required" }, { status: 400 });
  }

  const result = await acceptInviteById(user.id, user.email, inviteId);
  if (!result.ok) {
    return NextResponse.json({ error: result.message }, { status: result.status });
  }

  return NextResponse.json({
    organizationName: result.organizationName,
    redirectTo: "/account/team",
  });
}
