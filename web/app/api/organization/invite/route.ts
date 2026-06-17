import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { sendOrganizationInviteEmail } from "@/lib/organization/invites";

async function getOwnedOrg(userId: string) {
  return db.organization.findUnique({
    where: { ownerUserId: userId },
    select: { id: true, name: true },
  });
}

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOwnedOrg(user.id);
  if (!org) return NextResponse.json({ invites: [] });

  try {
    const invites = await db.organizationInvite.findMany({
      where: { organizationId: org.id, acceptedAt: null },
      orderBy: { invitedAt: "desc" },
      select: { id: true, email: true, role: true, invitedAt: true },
    });
    return NextResponse.json({ invites });
  } catch {
    return NextResponse.json({ invites: [], _migrationPending: true });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const org = await getOwnedOrg(user.id);
  if (!org) {
    return NextResponse.json({ error: "Create an organization first" }, { status: 400 });
  }

  let email = "";
  try {
    const body = (await req.json()) as { email?: string };
    email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!email || !email.includes("@")) {
    return NextResponse.json({ error: "Valid email required" }, { status: 400 });
  }

  try {
    const invite = await db.organizationInvite.upsert({
      where: { organizationId_email: { organizationId: org.id, email } },
      create: { organizationId: org.id, email, role: "member" },
      update: { invitedAt: new Date(), acceptedAt: null },
      select: { id: true, email: true },
    });

    const orgDetails = await db.organization.findUnique({
      where: { id: org.id },
      select: { name: true },
    });
    const emailed = await sendOrganizationInviteEmail({
      inviteId: invite.id,
      email: invite.email,
      organizationName: orgDetails?.name ?? "your team",
      inviterName: user.name,
    });

    return NextResponse.json({ invite, emailed });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("organization_invite")) {
      return NextResponse.json({ error: "Invites table not migrated yet" }, { status: 503 });
    }
    throw e;
  }
}
