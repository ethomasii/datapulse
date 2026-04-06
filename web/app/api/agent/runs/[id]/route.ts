/**
 * PATCH /api/agent/runs/:id
 *
 * Agent reports run progress, log lines, and final status.
 * Authenticated by Bearer agentToken.
 *
 * Body (all optional):
 *   status?: "running" | "succeeded" | "failed" | "cancelled"
 *   appendLog?: { level: "info"|"warn"|"error", message: string }
 *   logEntries?: Array<{ at: string, level: string, message: string }>
 *   errorSummary?: string | null
 *   finishedAt?: string | null
 */
import { NextResponse } from "next/server";
import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { getUserFromAgentToken } from "@/lib/agent/auth";
import { maybeDispatchRunWebhook } from "@/lib/elt/maybe-dispatch-run-webhook";
import { sanitizeForRunStorage } from "@/lib/elt/run-log-sanitize";

type LogEntry = { at: string; level: string; message: string };

function isTerminal(s: string) {
  return s === "succeeded" || s === "failed" || s === "cancelled";
}

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: Request, { params }: Params) {
  const user = await getUserFromAgentToken(req);
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const existing = await db.eltPipelineRun.findFirst({ where: { id, userId: user.id } });
  if (!existing) return NextResponse.json({ error: "Not found" }, { status: 404 });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  let logEntries: LogEntry[] = Array.isArray(existing.logEntries)
    ? (existing.logEntries as unknown as LogEntry[])
    : [];

  if (body.appendLog && typeof body.appendLog === "object") {
    const l = body.appendLog as Record<string, string>;
    logEntries = [
      ...logEntries,
      { at: new Date().toISOString(), level: l.level ?? "info", message: sanitizeForRunStorage(l.message ?? "", 4000) },
    ].slice(-500);
  }

  if (Array.isArray(body.logEntries)) {
    logEntries = (body.logEntries as LogEntry[]).map((e) => ({
      ...e,
      message: sanitizeForRunStorage(e.message, 4000),
    }));
  }

  const nextStatus = (typeof body.status === "string" ? body.status : existing.status) as string;
  const wasTerminal = isTerminal(existing.status);
  const willBeTerminal = isTerminal(nextStatus);

  let finishedAt = existing.finishedAt;
  if (body.finishedAt !== undefined) {
    finishedAt = body.finishedAt ? new Date(body.finishedAt as string) : null;
  } else if (willBeTerminal && !existing.finishedAt) {
    finishedAt = new Date();
  }

  const errorSummary =
    body.errorSummary === undefined
      ? undefined
      : body.errorSummary === null
        ? null
        : sanitizeForRunStorage(String(body.errorSummary));

  const data: Prisma.EltPipelineRunUpdateInput = {
    status: nextStatus as never,
    logEntries: logEntries as unknown as Prisma.InputJsonValue,
    finishedAt,
    ...(errorSummary !== undefined ? { errorSummary } : {}),
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
