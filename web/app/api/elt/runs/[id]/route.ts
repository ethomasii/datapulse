import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import {
  API_SCOPES,
  hasScope,
  resolveApiUser,
  scopeForbiddenResponse,
  unauthorizedResponse,
} from "@/lib/auth/api-user";
import { db } from "@/lib/db/client";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import { applyPatchRunBody } from "@/lib/elt/apply-run-patch";
import { syncCatalogFromDbtManifest } from "@/lib/elt/catalog-sync-from-run";
import { maybeDispatchContractAlerts } from "@/lib/elt/maybe-dispatch-contract-alerts";
import { parseRunTelemetry } from "@/lib/elt/run-telemetry";
import { patchRunBodySchema } from "@/lib/elt/run-types";

type RouteContext = { params: { id: string } };

export async function GET(req: Request, context: RouteContext) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_READ)) return scopeForbiddenResponse();

  const { id } = context.params;
  const run = await db.eltPipelineRun.findFirst({
    where: { id, userId: auth.user.id },
    include: {
      pipeline: { select: { id: true, name: true, tool: true, sourceType: true, sourceConfiguration: true } },
      dbtProject: { select: { id: true, name: true } },
      targetAgentToken: { select: { id: true, name: true } },
    },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function PATCH(req: Request, context: RouteContext) {
  const auth = await resolveApiUser(req);
  if (!auth) return unauthorizedResponse();
  if (!hasScope(auth, API_SCOPES.RUNS_WRITE)) return scopeForbiddenResponse();
  const user = auth.user;

  const { id } = context.params;
  const existing = await db.eltPipelineRun.findFirst({
    where: { id, userId: user.id },
  });
  if (!existing) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  let json: unknown;
  try {
    json = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = patchRunBodySchema.safeParse(json);
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const body = parsed.data;

  const patch = applyPatchRunBody(
    {
      status: existing.status,
      logEntries: existing.logEntries,
      telemetry: (existing as { telemetry?: unknown }).telemetry,
      finishedAt: existing.finishedAt,
    },
    body
  );

  const promoteExecutor =
    existing.ingestionExecutor === "unspecified" ? ({ ingestionExecutor: "customer_control_plane" } as const) : {};

  const logTouched = body.logEntries !== undefined || body.appendLog !== undefined;
  const data: Prisma.EltPipelineRunUpdateInput = {
    status: patch.nextStatus as never,
    ...promoteExecutor,
    ...(logTouched ? { logEntries: patch.logEntries as unknown as Prisma.InputJsonValue } : {}),
    ...(patch.telemetryJson !== undefined ? { telemetry: patch.telemetryJson } : {}),
    ...(patch.errorSummary !== undefined ? { errorSummary: patch.errorSummary } : {}),
    finishedAt: patch.nextFinishedAt,
  };

  const run = await db.eltPipelineRun.update({
    where: { id },
    data,
    include: {
      pipeline: { select: { id: true, name: true } },
      dbtProject: { select: { id: true, name: true } },
    },
  });

  if (patch.willBeTerminal && !patch.wasTerminal) {
    await maybeDispatchRunWebhook(run.id, user.id);
    if (patch.nextStatus === "succeeded" && existing.pipelineId && patch.telemetryJson) {
      const tel = parseRunTelemetry(patch.telemetryJson);
      if (tel.dbt) {
        void syncCatalogFromDbtManifest(user.id, existing.pipelineId, tel.dbt).catch(() => undefined);
      }
      void maybeDispatchContractAlerts(run.id, user.id).catch(() => undefined);
    }
  }

  return NextResponse.json({ run });
}
