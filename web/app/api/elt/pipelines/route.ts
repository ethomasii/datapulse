import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema } from "@/lib/elt/types";
import { createPipelineDefinition } from "@/lib/elt/persist-pipeline";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const rows = await db.eltPipeline.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
    select: {
      id: true,
      name: true,
      tool: true,
      enabled: true,
      sourceType: true,
      destinationType: true,
      description: true,
      updatedAt: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
    },
  });
  return NextResponse.json({ pipelines: rows });
}

export async function POST(req: Request) {
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

  const parsed = createPipelineBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten().fieldErrors },
      { status: 400 }
    );
  }

  const body = parsed.data;
  try {
    const result = await createPipelineDefinition(user.id, body);
    if (!result.ok) {
      return NextResponse.json({ error: result.message }, { status: result.status });
    }
    return NextResponse.json({ pipeline: result.pipeline }, { status: 201 });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
