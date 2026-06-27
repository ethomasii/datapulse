import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { getAccessibleResourceOwnerIds } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db/client";
import { inferTransformFromExample } from "@/lib/elt/infer-transform-from-example";
import { resolveRouteParamId } from "@/lib/server/route-params";

const bodySchema = z.object({
  inputTable: z.string().min(1).max(256),
  inputColumns: z.array(z.string()).default([]),
  inputSampleRows: z.array(z.record(z.string(), z.unknown())).default([]),
  outputExampleRows: z.array(z.record(z.string(), z.unknown())).optional(),
  outputDescription: z.string().max(4000).optional(),
  imageBase64: z.string().max(6_000_000).optional(),
  imageMediaType: z.enum(["image/jpeg", "image/png", "image/gif", "image/webp"]).optional(),
});

/**
 * POST /api/elt/pipelines/[id]/transform-by-example
 */
export async function POST(req: Request, ctx: { params: Promise<{ id: string }> }) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const pipelineId = await resolveRouteParamId(ctx.params);
  if (!pipelineId) return NextResponse.json({ error: "Invalid pipeline id" }, { status: 400 });

  let body: z.infer<typeof bodySchema>;
  try {
    body = bodySchema.parse(await req.json());
  } catch {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  if (
    !body.outputExampleRows?.length &&
    !body.outputDescription?.trim() &&
    !body.imageBase64
  ) {
    return NextResponse.json(
      { error: "Provide target example rows, a description, or a screenshot." },
      { status: 400 }
    );
  }

  if (body.imageBase64 && !body.imageMediaType) {
    return NextResponse.json({ error: "imageMediaType required with imageBase64" }, { status: 400 });
  }

  const ownerIds = await getAccessibleResourceOwnerIds(user.id);
  const pipeline = await db.eltPipeline.findFirst({
    where: {
      OR: [{ id: pipelineId }, { name: pipelineId }],
      userId: { in: ownerIds },
    },
    select: { id: true },
  });
  if (!pipeline) return NextResponse.json({ error: "Pipeline not found" }, { status: 404 });

  try {
    const inferred = await inferTransformFromExample(body);
    return NextResponse.json({ inferred });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: msg }, { status: 400 });
  }
}
