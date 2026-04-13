/**
 * PATCH /api/organization/gateway-default — org workspace default named gateway for unrouted runs.
 * Requires an active Clerk org (or DB org) session; `null` clears.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { assertActorOwnsGatewayToken } from "@/lib/agent/gateway-routing";
import { getActiveOrganizationForSession } from "@/lib/auth/active-org";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  defaultAgentTokenId: z.string().min(1).nullable(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const sessionOrg = await getActiveOrganizationForSession();
  if (!sessionOrg) {
    return NextResponse.json(
      { error: "Open an organization workspace to set the org default gateway." },
      { status: 400 }
    );
  }

  const org = await db.organization.findFirst({
    where: {
      id: sessionOrg.id,
      OR: [{ ownerUserId: user.id }, { members: { some: { id: user.id } } }],
    },
    select: { id: true },
  });
  if (!org) {
    return NextResponse.json({ error: "Organization not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = bodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const id = parsed.data.defaultAgentTokenId;
  if (id !== null) {
    try {
      await assertActorOwnsGatewayToken(user.id, id);
    } catch {
      return NextResponse.json({ error: "Invalid gateway" }, { status: 400 });
    }
  }

  const updated = await db.organization.update({
    where: { id: org.id },
    data: { defaultAgentTokenId: id },
    select: { defaultAgentTokenId: true },
  });

  return NextResponse.json({ defaultAgentTokenId: updated.defaultAgentTokenId });
}
