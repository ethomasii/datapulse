import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import type { WorkflowDefinition } from "@/lib/elt/elt-workflow-runner";

const nodeSchema = z.object({
  id: z.string().min(1),
  type: z.enum(["pipeline", "monitor", "webhook"]),
  pipelineId: z.string().optional(),
  monitorId: z.string().optional(),
  webhookUrl: z.string().url().optional(),
  label: z.string().optional(),
});

const edgeSchema = z.object({
  from: z.string().min(1),
  to: z.string().min(1),
  on: z.enum(["success", "failure", "always"]),
});

const createSchema = z.object({
  name: z.string().min(1).max(120),
  enabled: z.boolean().optional(),
  description: z.string().max(2000).optional(),
  definition: z
    .object({
      nodes: z.array(nodeSchema),
      edges: z.array(edgeSchema),
    })
    .optional(),
});

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const workflows = await db.eltWorkflow.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
    });
    return NextResponse.json({ workflows });
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
  const definition: WorkflowDefinition = d.definition ?? { nodes: [], edges: [] };
  try {
    const workflow = await db.eltWorkflow.create({
      data: {
        userId: user.id,
        name: d.name,
        enabled: d.enabled ?? true,
        description: d.description ?? null,
        definition,
      },
    });
    return NextResponse.json({ workflow }, { status: 201 });
  } catch (e) {
    const drift = prismaSchemaDriftResponse(e);
    if (drift) return drift;
    throw e;
  }
}
