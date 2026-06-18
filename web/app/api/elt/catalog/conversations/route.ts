import { NextResponse } from "next/server";
import { z } from "zod";
import {
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { hasCatalogReadScope, hasCatalogWriteScope } from "@/lib/auth/workspace-auth-helpers";
import { db } from "@/lib/db/client";
import { assetDetailHref } from "@/lib/elt/asset-path";

async function maybeNotifySlack(input: {
  assetKey: string;
  authorName: string;
  body: string;
  assetLabel?: string;
}) {
  const webhook = process.env.SLACK_CATALOG_WEBHOOK_URL?.trim();
  if (!webhook) return;

  const origin = process.env.NEXT_PUBLIC_APP_URL?.trim() || "https://app.eltpulse.com";
  const link = `${origin}${assetDetailHref(input.assetKey)}`;

  await fetch(webhook, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      text: `💬 *${input.authorName}* on *${input.assetLabel ?? input.assetKey}*:\n${input.body.slice(0, 500)}\n<${link}|Open in catalog>`,
    }),
  }).catch(() => undefined);
}

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const assetKey = new URL(req.url).searchParams.get("assetKey")?.trim();
  if (!assetKey) {
    return NextResponse.json({ error: "assetKey required" }, { status: 400 });
  }

  const comments = await db.catalogAssetComment.findMany({
    where: { assetKey, parentId: null },
    orderBy: { createdAt: "asc" },
    include: {
      replies: { orderBy: { createdAt: "asc" } },
      user: { select: { name: true, email: true, imageUrl: true } },
    },
  });

  return NextResponse.json({ assetKey, comments, slackEnabled: Boolean(process.env.SLACK_CATALOG_WEBHOOK_URL) });
}

const postSchema = z.object({
  assetKey: z.string().min(1).max(512),
  body: z.string().min(1).max(4000),
  parentId: z.string().nullable().optional(),
});

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

  const user = await db.user.findUnique({ where: { id: auth.user.id } });
  const authorName = user?.name?.trim() || user?.email?.split("@")[0] || "User";
  const authorEmail = user?.email ?? null;

  const comment = await db.catalogAssetComment.create({
    data: {
      userId: auth.user.id,
      assetKey: body.assetKey,
      body: body.body.trim(),
      authorName,
      authorEmail,
      parentId: body.parentId ?? null,
    },
  });

  if (!body.parentId) {
    void maybeNotifySlack({
      assetKey: body.assetKey,
      authorName,
      body: body.body.trim(),
    });
  }

  return NextResponse.json({ comment });
}

export async function DELETE(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogWriteScope(auth)) return scopeForbiddenResponse();

  const id = new URL(req.url).searchParams.get("id")?.trim();
  if (!id) return NextResponse.json({ error: "id required" }, { status: 400 });

  const row = await db.catalogAssetComment.findFirst({ where: { id, userId: auth.user.id } });
  if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });

  await db.catalogAssetComment.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
