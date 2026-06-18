import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import type { AlertMetric } from "@/lib/elt/observability-alerts";

const createSchema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  metric: z.enum(["success_rate", "freshness_hours", "row_drop_pct", "failed_runs"] satisfies AlertMetric[]),
  operator: z.enum(["lt", "gt", "lte", "gte"]).optional(),
  threshold: z.number(),
  windowDays: z.number().int().min(1).max(90).optional(),
  pipelineId: z.string().nullable().optional(),
  notifyWebhook: z.boolean().optional(),
});

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const rules = await db.observabilityAlertRule.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
    });
    return NextResponse.json({ rules });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = createSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  const d = parsed.data;
  try {
    const rule = await db.observabilityAlertRule.create({
      data: {
        userId: user.id,
        name: d.name,
        enabled: d.enabled ?? true,
        metric: d.metric,
        operator: d.operator ?? "lt",
        threshold: d.threshold,
        windowDays: d.windowDays ?? 7,
        pipelineId: d.pipelineId ?? null,
        notifyWebhook: d.notifyWebhook ?? true,
      },
    });
    return NextResponse.json({ rule }, { status: 201 });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
