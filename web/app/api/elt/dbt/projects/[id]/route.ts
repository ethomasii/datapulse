import { NextResponse } from "next/server";
import { z } from "zod";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { resolveRouteParamId } from "@/lib/server/route-params";
import { assertCanWritePipelines, hasCatalogReadScope } from "@/lib/auth/workspace-auth-helpers";
import {
  assertDbtProjectAccess,
  linkDbtProjectToPipeline,
  toDbtProjectSummary,
} from "@/lib/elt/dbt-projects";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

const patchSchema = z.object({
  name: z.string().min(1).max(128).optional(),
  description: z.string().max(4000).nullable().optional(),
  packagePath: z.string().min(1).max(2048).optional(),
  gitUrl: z.string().max(2048).nullable().optional(),
  gitBranch: z.string().max(128).nullable().optional(),
  gitSubpath: z.string().max(512).nullable().optional(),
  targetSchema: z.string().max(256).nullable().optional(),
  sourceSlug: z.string().max(128).nullable().optional(),
  runScope: z.enum(["all", "selection"]).optional(),
  selector: z.string().max(512).nullable().optional(),
  scheduleEnabled: z.boolean().optional(),
  cronSchedule: z.string().max(256).nullable().optional(),
  scheduleTimezone: z.string().max(64).optional(),
  destinationConnectionId: z.string().nullable().optional(),
});

export async function GET(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasCatalogReadScope(auth)) return scopeForbiddenResponse();

  const id = await resolveRouteParamId(ctx.params);
  try {
    const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
    const row = await db.dbtProject.findFirst({
      where: { id, userId: { in: ownerIds } },
      include: {
        pipelines: {
          select: { id: true, name: true, enabled: true, sourceType: true, destinationType: true },
        },
      },
    });
    if (!row) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ project: toDbtProjectSummary(row) });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}

export async function PUT(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const denied = await assertCanWritePipelines(auth.user.id);
  if (denied) return denied;

  const id = await resolveRouteParamId(ctx.params);
  const parsed = patchSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    await assertDbtProjectAccess(auth.user.id, id);
    const data = parsed.data;
    const row = await db.dbtProject.update({
      where: { id },
      data: {
        ...(data.name !== undefined ? { name: data.name.trim() } : {}),
        ...(data.description !== undefined ? { description: data.description } : {}),
        ...(data.packagePath !== undefined ? { packagePath: data.packagePath.trim() } : {}),
        ...(data.gitUrl !== undefined ? { gitUrl: data.gitUrl } : {}),
        ...(data.gitBranch !== undefined ? { gitBranch: data.gitBranch } : {}),
        ...(data.gitSubpath !== undefined ? { gitSubpath: data.gitSubpath } : {}),
        ...(data.targetSchema !== undefined ? { targetSchema: data.targetSchema } : {}),
        ...(data.sourceSlug !== undefined ? { sourceSlug: data.sourceSlug } : {}),
        ...(data.runScope !== undefined ? { runScope: data.runScope } : {}),
        ...(data.selector !== undefined ? { selector: data.selector } : {}),
        ...(data.scheduleEnabled !== undefined ? { scheduleEnabled: data.scheduleEnabled } : {}),
        ...(data.cronSchedule !== undefined ? { cronSchedule: data.cronSchedule } : {}),
        ...(data.scheduleTimezone !== undefined ? { scheduleTimezone: data.scheduleTimezone } : {}),
        ...(data.destinationConnectionId !== undefined
          ? { destinationConnectionId: data.destinationConnectionId }
          : {}),
      },
      include: {
        pipelines: {
          select: { id: true, name: true, enabled: true, sourceType: true, destinationType: true },
        },
      },
    });

    for (const p of row.pipelines) {
      await linkDbtProjectToPipeline(auth.user.id, row.id, p.id);
    }

    return NextResponse.json({ project: toDbtProjectSummary(row) });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Update failed";
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}

export async function DELETE(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();
  const denied = await assertCanWritePipelines(auth.user.id);
  if (denied) return denied;

  const id = await resolveRouteParamId(ctx.params);
  try {
    const ownerIds = await getAccessibleResourceOwnerIds(auth.user.id);
    const res = await db.dbtProject.deleteMany({ where: { id, userId: { in: ownerIds } } });
    if (res.count === 0) return NextResponse.json({ error: "Not found" }, { status: 404 });
    return NextResponse.json({ ok: true });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
