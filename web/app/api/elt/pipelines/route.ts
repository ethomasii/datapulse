import { NextResponse } from "next/server";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { db } from "@/lib/db/client";
import { prismaSchemaDriftResponse } from "@/lib/db/prisma-schema-drift-response";
import { createPipelineBodySchema } from "@/lib/elt/types";
import { createPipelineDefinition } from "@/lib/elt/persist-pipeline";

export async function GET(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_READ)) return scopeForbiddenResponse();

  const rows = await db.eltPipeline.findMany({
    where: { userId: auth.user.id },
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
      sourceConnectionId: true,
      destinationConnectionId: true,
      sourceConfiguration: true,
    },
  });

  const pipelines = rows.map((row) => {
    const cfg = (row.sourceConfiguration ?? {}) as Record<string, unknown>;
    const scheduleEnabled = Boolean(cfg.schedule_enabled ?? cfg.scheduleEnabled);
    const cron = typeof cfg.cron_schedule === "string" ? cfg.cron_schedule : null;
    const timezone = typeof cfg.schedule_timezone === "string" ? cfg.schedule_timezone : "UTC";
    return {
      id: row.id,
      name: row.name,
      tool: row.tool,
      enabled: row.enabled,
      sourceType: row.sourceType,
      destinationType: row.destinationType,
      description: row.description,
      updatedAt: row.updatedAt,
      defaultTargetAgentTokenId: row.defaultTargetAgentTokenId,
      executionHost: row.executionHost,
      sourceConnectionId: row.sourceConnectionId,
      destinationConnectionId: row.destinationConnectionId,
      scheduleInfo: { enabled: scheduleEnabled, cron, timezone },
    };
  });

  return NextResponse.json({ pipelines });
}

export async function POST(req: Request) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.PIPELINES_WRITE)) return scopeForbiddenResponse();

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

  try {
    const result = await createPipelineDefinition(auth.user.id, parsed.data);
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
