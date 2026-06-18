import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { fetchPipelineMetricsForUser } from "@/lib/elt/pipeline-metrics";
import { evaluateAlertRule } from "@/lib/elt/observability-alerts";
import { deliverRunWebhook } from "@/lib/elt/run-webhook";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: Promise<{ id: string }> };

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    metric: z.enum(["success_rate", "freshness_hours", "row_drop_pct", "failed_runs"]).optional(),
    operator: z.enum(["lt", "gt", "lte", "gte"]).optional(),
    threshold: z.number().optional(),
    windowDays: z.number().int().min(1).max(90).optional(),
    pipelineId: z.string().nullable().optional(),
    notifyWebhook: z.boolean().optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields" });

export async function PATCH(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await resolveRouteParamId(ctx.params);
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const parsed = patchSchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }
  try {
    const existing = await db.observabilityAlertRule.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const rule = await db.observabilityAlertRule.update({
      where: { id },
      data: parsed.data,
    });
    return NextResponse.json({ rule });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function DELETE(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await resolveRouteParamId(ctx.params);
  try {
    const res = await db.observabilityAlertRule.deleteMany({ where: { id, userId: user.id } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

/** POST evaluate — dry-run or fire webhooks for triggered rules. */
export async function POST(req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await resolveRouteParamId(ctx.params);
  const url = new URL(req.url);
  const fire = url.searchParams.get("fire") === "1";

  try {
    const rule = await db.observabilityAlertRule.findFirst({ where: { id, userId: user.id } });
    if (!rule) return NextResponse.json({ error: "Not found" }, { status: 404 });

    const metrics = await fetchPipelineMetricsForUser(user.id, {
      days: rule.windowDays,
      pipelineId: rule.pipelineId ?? undefined,
    });
    const pipelineName = rule.pipelineId
      ? metrics.byPipeline.find((p) => p.pipelineId === rule.pipelineId)?.pipelineName
      : undefined;
    const evaluation = evaluateAlertRule(rule, metrics, pipelineName);
    if (!evaluation) return NextResponse.json({ error: "Unknown metric" }, { status: 400 });

    if (fire && evaluation.triggered && rule.notifyWebhook) {
      const account = await db.user.findUnique({
        where: { id: user.id },
        select: { runsWebhookUrl: true },
      });
      const webhookUrl = account?.runsWebhookUrl;
      if (webhookUrl) {
        await deliverRunWebhook(webhookUrl, {
          source: "eltpulse",
          event: "run.failed",
          correlationId: `alert-${rule.id}-${Date.now()}`,
          pipelineId: rule.pipelineId,
          pipelineName: pipelineName ?? rule.name,
          environment: "production",
          status: "alert",
          errorSummary: evaluation.message,
          startedAt: new Date().toISOString(),
          finishedAt: new Date().toISOString(),
          runUrl: "/observability",
        });
        await db.observabilityAlertRule.update({
          where: { id: rule.id },
          data: { lastTriggeredAt: new Date() },
        });
      }
    }

    return NextResponse.json({ evaluation });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
