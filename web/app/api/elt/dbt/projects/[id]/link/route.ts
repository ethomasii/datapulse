import { NextResponse } from "next/server";
import { z } from "zod";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { resolveRouteParamId } from "@/lib/server/route-params";
import { linkDbtProjectToPipeline, toDbtProjectSummary } from "@/lib/elt/dbt-projects";

type Ctx = { params: { id: string } | Promise<{ id: string }> };

const bodySchema = z.object({
  pipelineId: z.string().min(1),
});

export async function POST(req: Request, ctx: Ctx) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();

  const id = await resolveRouteParamId(ctx.params);
  const parsed = bodySchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  try {
    const { project, pipeline } = await linkDbtProjectToPipeline(auth.user.id, id, parsed.data.pipelineId);
    return NextResponse.json({
      project: toDbtProjectSummary({ ...project, pipelines: [pipeline] }),
      pipelineId: pipeline.id,
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Link failed";
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
