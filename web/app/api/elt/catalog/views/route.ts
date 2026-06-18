import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import { db } from "@/lib/db/client";

const postSchema = z.object({ assetKey: z.string().min(1).max(512) });

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const limit = Math.min(20, Math.max(1, Number(new URL(req.url).searchParams.get("limit") ?? 10) || 10));

  const views = await db.catalogAssetView.findMany({
    where: { userId: auth.user.id },
    orderBy: { viewedAt: "desc" },
    take: limit,
  });

  return NextResponse.json({ views });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  let body: z.infer<typeof postSchema>;
  try {
    body = postSchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  await db.catalogAssetView.upsert({
    where: { userId_assetKey: { userId: auth.user.id, assetKey: body.assetKey } },
    create: { userId: auth.user.id, assetKey: body.assetKey },
    update: { viewedAt: new Date() },
  });

  return NextResponse.json({ ok: true });
}
