import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { resolveRouteParamId } from "@/lib/server/route-params";

type Ctx = { params: Promise<{ id: string }> };

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["pipeline", "monitor", "webhook"]),
  pipelineId: z.string().optional(),
  monitorId: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  label: z.string().optional(),
});

const patchSchema = z
  .object({
    name: z.string().min(1).max(120).optional(),
    enabled: z.boolean().optional(),
    description: z.string().max(2000).nullable().optional(),
    definition: z
      .object({
        nodes: z.array(nodeSchema),
        edges: z.array(
          z.object({
            from: z.string().min(1),
            to: z.string().min(1),
            on: z.enum(["success", "failure", "always"]),
          })
        ),
      })
      .optional(),
  })
  .refine((d) => Object.keys(d).length > 0, { message: "No fields" });

export async function GET(_req: Request, ctx: Ctx) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const id = await resolveRouteParamId(ctx.params);
  try {
    const workflow = await db.eltWorkflow.findFirst({ where: { id, userId: user.id } });
    if (!workflow) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ workflow });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

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
    const existing = await db.eltWorkflow.findFirst({ where: { id, userId: user.id } });
    if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });
    const workflow = await db.eltWorkflow.update({ where: { id }, data: parsed.data });
    return NextResponse.json({ workflow });
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
    const res = await db.eltWorkflow.deleteMany({ where: { id, userId: user.id } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
