import type { Prisma } from "@prisma/client";
import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { credentialProfileFromConnection } from "@/lib/monitors/connection-auth";
import {
  connectorMatchesMonitorType,
  monitorTypeRequiresConnection,
} from "@/lib/monitors/monitor-types";
import { runMonitorChecksForUser } from "@/lib/monitors/run-monitors";

export async function monitorsGET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const rows = await db.eltMonitor.findMany({
    where: { userId: user.id },
    orderBy: { updatedAt: "desc" },
  });

  const sensors = rows.map((row) => ({
    name: row.name,
    type: row.type,
    pipeline_name: row.pipelineName,
    config: row.config as Record<string, unknown>,
    last_check: row.lastCheckAt?.toISOString(),
  }));

  return NextResponse.json({ sensors, monitors: sensors });
}

export async function monitorsPOST(request: NextRequest) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: Record<string, unknown>;
  try {
    body = (await request.json()) as Record<string, unknown>;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const name = typeof body.name === "string" ? body.name.trim() : "";
  const pipelineName = typeof body.pipelineName === "string" ? body.pipelineName.trim() : "";
  const type = typeof body.type === "string" ? body.type.trim() : "";
  const connectionId = typeof body.connectionId === "string" ? body.connectionId.trim() : "";
  const configIn = body.config;

  if (!name || !pipelineName || !type || !configIn || typeof configIn !== "object" || Array.isArray(configIn)) {
    return NextResponse.json(
      { error: "Missing required fields: name, pipelineName, type, config" },
      { status: 400 }
    );
  }

  const config: Record<string, unknown> = { ...(configIn as Record<string, unknown>) };
  let resolvedConnectionId: string | null = null;

  if (monitorTypeRequiresConnection(type)) {
    if (!connectionId) {
      return NextResponse.json(
        {
          error: "A saved connection is required for this monitor type",
          hint: "Create a matching connection under Connections, then select it here so checks use your credential profile and environment hints.",
        },
        { status: 400 }
      );
    }

    const connection = await db.connection.findFirst({
      where: { id: connectionId, userId: user.id },
    });
    if (!connection) {
      return NextResponse.json({ error: "Connection not found" }, { status: 404 });
    }
    if (!connectorMatchesMonitorType(connection.connector, type)) {
      return NextResponse.json(
        {
          error: `Connection connector "${connection.connector}" does not match this monitor type`,
          hint: "Pick a connection whose provider matches the cloud API this monitor calls (e.g. S3 connection for S3 object count).",
        },
        { status: 400 }
      );
    }

    const profile = credentialProfileFromConnection(connection);
    config.eltpulse_connection_id = connection.id;
    config.eltpulse_connection_name = connection.name;
    config.eltpulse_connection_connector = connection.connector;
    config.auth_credentials = profile;
    resolvedConnectionId = connection.id;
  }

  try {
    await db.eltMonitor.create({
      data: {
        userId: user.id,
        name,
        pipelineName,
        type,
        config: config as Prisma.InputJsonValue,
        connectionId: resolvedConnectionId,
      },
    });
  } catch (e: unknown) {
    const code = typeof e === "object" && e !== null && "code" in e ? String((e as { code: unknown }).code) : "";
    if (code === "P2002") {
      return NextResponse.json({ error: "A monitor with this name already exists" }, { status: 409 });
    }
    throw e;
  }

  return NextResponse.json({
    success: true,
    message: `Monitor '${name}' created successfully`,
  });
}

export async function monitorsCheckPOST(request: NextRequest) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: { pipeline?: string } = {};
  try {
    body = (await request.json()) as { pipeline?: string };
  } catch {
    /* empty body */
  }

  const pipeline = typeof body.pipeline === "string" ? body.pipeline.trim() : "";

  const { triggeredSensors, errors } = await runMonitorChecksForUser(user.id, {
    pipelineFilter: pipeline || undefined,
  });

  const errText = errors.join("\n");
  return NextResponse.json({
    triggeredSensors,
    monitorsTriggered: triggeredSensors,
    totalTriggered: triggeredSensors.length,
    output: "",
    hasErrors: errors.length > 0,
    errors: errText,
  });
}

export async function monitorsDELETE(name: string) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!name) {
    return NextResponse.json({ error: "Monitor name is required" }, { status: 400 });
  }

  const result = await db.eltMonitor.deleteMany({
    where: { userId: user.id, name },
  });

  if (result.count === 0) {
    return NextResponse.json({ error: "Monitor not found" }, { status: 404 });
  }

  return NextResponse.json({
    success: true,
    message: `Monitor '${name}' deleted successfully`,
  });
}
