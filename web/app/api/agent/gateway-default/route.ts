/**
 * PATCH /api/agent/gateway-default — set which named gateway receives unrouted runs
 * (no pipeline default, no explicit `targetAgentTokenId` on create). `null` clears.
 */
import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { assertUserOwnsGatewayToken } from "@/lib/agent/gateway-routing";

export const dynamic = "force-dynamic";

const bodySchema = z.object({
  defaultAgentTokenId: z.string().min(1).nullable(),
});

export async function PATCH(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

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
      await assertUserOwnsGatewayToken(user.id, id);
    } catch {
      return NextResponse.json({ error: "Invalid gateway" }, { status: 400 });
    }
  }

  const updated = await db.user.update({
    where: { id: user.id },
    data: { defaultAgentTokenId: id },
    select: { defaultAgentTokenId: true },
  });

  return NextResponse.json({ defaultAgentTokenId: updated.defaultAgentTokenId });
}
