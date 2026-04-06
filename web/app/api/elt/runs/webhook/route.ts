import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { normalizeRunWebhookUrl } from "@/lib/elt/validate-run-webhook-url";

/** Account default + per-pipeline run webhooks (all optional). `url` mirrors `globalUrl` for older clients. */
export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const [account, pipelines] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { runsWebhookUrl: true },
    }),
    db.eltPipeline.findMany({
      where: { userId: user.id },
      orderBy: { name: "asc" },
      select: { id: true, name: true, runsWebhookUrl: true },
    }),
  ]);

  const globalUrl = account?.runsWebhookUrl ?? null;
  return NextResponse.json({
    url: globalUrl,
    globalUrl,
    pipelines: pipelines.map((p) => ({
      id: p.id,
      name: p.name,
      webhookUrl: p.runsWebhookUrl,
    })),
  });
}

export async function PUT(req: Request) {
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

  await db.user.update({
    where: { id: user.id },
    data: { runsWebhookUrl: url },
  });

  return NextResponse.json({ url, globalUrl: url });
}
