import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { API_SCOPES } from "@/lib/auth/api-user";
import { generateApiKey } from "@/lib/auth/workspace-api-key";
import { db } from "@/lib/db/client";
import { assertApiKeyLimit, resolveUserPlanTier } from "@/lib/plans/tier-features";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const keys = await db.workspaceApiKey.findMany({
      where: { userId: user.id, revokedAt: null },
      orderBy: { createdAt: "desc" },
      select: {
        id: true,
        name: true,
        keyPrefix: true,
        scopes: true,
        lastUsedAt: true,
        createdAt: true,
      },
    });
    return NextResponse.json({ keys });
  } catch {
    return NextResponse.json({ keys: [], _migrationPending: true });
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let name = "Default";
  try {
    const body = (await req.json()) as { name?: string };
    if (typeof body.name === "string" && body.name.trim()) {
      name = body.name.trim().slice(0, 64);
    }
  } catch {
    /* optional body */
  }

  const tier = await resolveUserPlanTier(user.id);
  const limitMsg = await assertApiKeyLimit(user.id, tier);
  if (limitMsg) {
    return NextResponse.json({ error: limitMsg }, { status: 403 });
  }

  const { raw, prefix, hash } = generateApiKey();

  try {
    const key = await db.workspaceApiKey.create({
      data: {
        userId: user.id,
        name,
        keyPrefix: prefix,
        keyHash: hash,
        scopes: Object.values(API_SCOPES),
      },
      select: { id: true, name: true, keyPrefix: true, createdAt: true },
    });
    return NextResponse.json({
      key,
      token: raw,
      message: "Copy this token now — it won't be shown again.",
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    if (msg.includes("does not exist") || msg.includes("workspace_api_key")) {
      return NextResponse.json(
        { error: "API keys table not migrated yet. Run prisma migrate deploy." },
        { status: 503 }
      );
    }
    throw e;
  }
}
