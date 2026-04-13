import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import { sanitizeForRunStorage } from "@/lib/elt/run-log-sanitize";
import { patchRunBodySchema, type LogEntry } from "@/lib/elt/run-types";

type RouteContext = { params: { id: string } };

function isTerminal(status: string): boolean {
  return status === "succeeded" || status === "failed" || status === "cancelled";
}

export async function GET(_req: Request, context: RouteContext) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = context.params;
  const run = await db.eltPipelineRun.findFirst({
    where: { id, userId: user.id },
    include: { pipeline: { select: { name: true, tool: true } } },
  });
  if (!run) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  return NextResponse.json({ run });
}

export async function PATCH(req: Request, context: RouteContext) {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

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

  let logEntries: LogEntry[] = Array.isArray(existing.logEntries)
    ? (existing.logEntries as unknown as LogEntry[])
    : [];

  if (body.appendLog) {
    const line: LogEntry = {
      at: new Date().toISOString(),
      level: body.appendLog.level,
      message: sanitizeForRunStorage(body.appendLog.message, 4000),
    };
    logEntries = [...logEntries, line].slice(-500);
  }

  if (body.logEntries) {
    logEntries = body.logEntries.map((e) => ({
      ...e,
      message: sanitizeForRunStorage(e.message, 4000),
    }));
  }

  const errorSummary =
    body.errorSummary === undefined
      ? undefined
      : body.errorSummary === null
        ? null
        : sanitizeForRunStorage(body.errorSummary);

  const nextStatus = body.status ?? existing.status;
  let nextFinishedAt = existing.finishedAt;
  if (body.finishedAt !== undefined) {
    nextFinishedAt = body.finishedAt ? new Date(body.finishedAt) : null;
  } else if (isTerminal(nextStatus) && !existing.finishedAt) {
    nextFinishedAt = new Date();
  }

  const wasTerminal = isTerminal(existing.status);
  const willBeTerminal = isTerminal(nextStatus);

  const promoteExecutor =
    existing.ingestionExecutor === "unspecified" ? ({ ingestionExecutor: "customer_control_plane" } as const) : {};

  const data: Prisma.EltPipelineRunUpdateInput = {
    status: nextStatus,
    ...promoteExecutor,
    ...(body.logEntries !== undefined || body.appendLog ? { logEntries: logEntries as unknown as Prisma.InputJsonValue } : {}),
    ...(errorSummary !== undefined ? { errorSummary } : {}),
    finishedAt: nextFinishedAt,
  };

  const run = await db.eltPipelineRun.update({
    where: { id },
    data,
    include: { pipeline: { select: { name: true } } },
  });

  if (willBeTerminal && !wasTerminal) {
    await maybeDispatchRunWebhook(run.id, user.id);
  }

  return NextResponse.json({ run });
}
