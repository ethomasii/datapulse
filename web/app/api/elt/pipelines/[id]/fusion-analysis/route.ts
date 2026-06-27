import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { analyzePipelineFusion } from "@/lib/elt/native-components/pipeline-fusion-analysis";
import { resolveRouteParamId } from "@/lib/server/route-params";

const bodySchema = z.object({
  elt_components: z.array(z.record(z.string(), z.unknown())).optional(),
  sourceConfiguration: z.record(z.string(), z.unknown()).optional(),
});

/**
 * POST /api/elt/pipelines/[id]/fusion-analysis — compact SQL fusion / materialization summary.
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelineId = await resolveRouteParamId(ctx.params);
  if (!pipelineId) return NextResponse.json({ error: "Invalid pipeline id" }, { status: 400 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json().catch(() => ({})));
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(user.id);

  const pipeline =
    (await db.eltPipeline.findFirst({
      where: { id: pipelineId, userId: { in: ownerIds } },
      select: { id: true, name: true, sourceConfiguration: true },
    })) ??
    (await db.eltPipeline.findFirst({
      where: { name: pipelineId, userId: { in: ownerIds } },
      select: { id: true, name: true, sourceConfiguration: true },
    }));

  if (!pipeline) {
    return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });
  }

  const saved = (pipeline.sourceConfiguration ?? {}) as Record<string, unknown>;
  const sourceConfiguration: Record<string, unknown> = {
    ...saved,
    ...(body.sourceConfiguration ?? {}),
    pipeline_name: pipeline.name,
    name: pipeline.name,
  };

  if (body.elt_components?.length) {
    sourceConfiguration.elt_components = body.elt_components;
  }

  const analysis = analyzePipelineFusion(sourceConfiguration, { pipelineName: pipeline.name });
  return NextResponse.json({ analysis });
}
