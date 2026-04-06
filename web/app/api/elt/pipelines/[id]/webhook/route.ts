import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";

type Ctx = { params: { id: string } };

/** Read per-pipeline run webhook (optional). */
export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const row = await db.eltPipeline.findFirst({
    where: { id: ctx.params.id, userId: user.id },
    select: { id: true, name: true, runsWebhookUrl: true },
  });
  if (!row) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }
  return NextResponse.json({
    pipelineId: row.id,
    name: row.name,
    url: row.runsWebhookUrl,
  });
}

/** Set or clear per-pipeline run webhook without sending the full pipeline body. */
export async function PUT(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const body = json as { url?: string | null };
  let url: string | null;
  try {
    url =
      body.url === null || body.url === undefined || body.url === ""
        ? null
        : normalizeRunWebhookUrl(String(body.url).trim());
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Invalid URL";
    return NextResponse.json({ error: msg }, { status: 400 });
  }

  const updated = await db.eltPipeline.updateMany({
    where: { id: ctx.params.id, userId: user.id },
    data: { runsWebhookUrl: url },
  });
  if (updated.count === 0) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ url });
}
