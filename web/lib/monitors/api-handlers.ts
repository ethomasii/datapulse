import { NextRequest, NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { runEltCli } from "@/lib/monitors/cli";
import { connectionConfigToProcessEnv, credentialProfileFromConnection } from "@/lib/monitors/connection-auth";
import {
  connectorMatchesMonitorType,
  monitorTypeRequiresConnection,
} from "@/lib/monitors/monitor-types";
import { readStoredSensorConfigs } from "@/lib/monitors/sensor-config";

function configObjectToCliString(config: Record<string, unknown>): string {
  return Object.entries(config)
    .map(([key, value]) => {
      if (value === null || value === undefined) return null;
      const v =
        typeof value === "boolean" || typeof value === "number"
          ? String(value)
          : String(value).trim();
      if (!v) return null;
      return `${key}=${v}`;
    })
    .filter(Boolean)
    .join(",");
}

export async function monitorsGET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { stdout, stderr, code } = await runEltCli(["sensors", "list", "--json"]);

  if (stderr && !stdout.includes("[")) {
    const { stdout: textOutput } = await runEltCli(["sensors", "list"]);
    return NextResponse.json({
      sensors: [],
      monitors: [],
      message: "No monitors found or CLI error",
      raw: textOutput,
    });
  }

  try {
    const sensors = JSON.parse(stdout) as unknown[];
    return NextResponse.json({ sensors, monitors: sensors });
  } catch {
    return NextResponse.json({
      sensors: [],
      monitors: [],
      message: "Could not parse monitor data",
      raw: stdout,
      stderr,
      code,
    });
  }
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
    config.datapulse_connection_id = connection.id;
    config.datapulse_connection_name = connection.name;
    config.datapulse_connection_connector = connection.connector;
    config.auth_credentials = profile;
  }

  const configStr = configObjectToCliString(config);
  if (!configStr) {
    return NextResponse.json({ error: "Monitor config is empty" }, { status: 400 });
  }

  const { stdout, stderr, code } = await runEltCli([
    "sensors",
    "create",
    name,
    pipelineName,
    "--type",
    type,
    "--config",
    configStr,
  ]);

  if (!stdout.includes("Created sensor")) {
    return NextResponse.json(
      { error: "Failed to create monitor", details: stderr || stdout || `exit ${code}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Monitor '${name}' created successfully`,
    output: stdout,
  });
}

async function buildCheckEnv(userId: string): Promise<Record<string, string>> {
  const rows = readStoredSensorConfigs();
  const ids = new Set<string>();
  for (const row of rows) {
    const id = row.config?.datapulse_connection_id;
    if (typeof id === "string" && id) ids.add(id);
  }
  if (ids.size === 0) return {};

  const connections = await db.connection.findMany({
    where: { userId, id: { in: Array.from(ids) } },
  });

  const merged: Record<string, string> = {};
  for (const c of connections) {
    Object.assign(merged, connectionConfigToProcessEnv(c));
  }
  return merged;
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
  const extraEnv = await buildCheckEnv(user.id);

  const args = pipeline
    ? (["sensors", "check", "--pipeline", pipeline] as const)
    : (["sensors", "check"] as const);
  const { stdout, stderr } = await runEltCli([...args], { env: extraEnv });

  const lines = stdout.split("\n");
  const triggeredSensors: Array<{
    sensorName: string;
    pipelineName: string;
    message: string;
    metadata: Record<string, unknown>;
    timestamp: string;
  }> = [];
  let currentSensor: (typeof triggeredSensors)[0] | null = null;

  for (const line of lines) {
    if (line.includes("→")) {
      const match = line.match(/\[bold\](.*?)\[\/bold\] → (.*)/);
      if (match) {
        if (currentSensor) triggeredSensors.push(currentSensor);
        currentSensor = {
          sensorName: match[1],
          pipelineName: match[2],
          message: "",
          metadata: {},
          timestamp: new Date().toISOString(),
        };
      }
    } else if (currentSensor && line.includes("Metadata:")) {
      try {
        const metadataMatch = line.match(/Metadata: (.+)/);
        if (metadataMatch) {
          currentSensor.metadata = JSON.parse(metadataMatch[1]) as Record<string, unknown>;
        }
      } catch {
        /* ignore */
      }
    } else if (currentSensor && line.trim() && !line.includes("⚡") && !line.includes("sensor(s) triggered")) {
      currentSensor.message = line.trim();
    }
  }

  if (currentSensor) triggeredSensors.push(currentSensor);

  return NextResponse.json({
    triggeredSensors,
    monitorsTriggered: triggeredSensors,
    totalTriggered: triggeredSensors.length,
    output: stdout,
    hasErrors: stderr.length > 0,
    errors: stderr,
  });
}

export async function monitorsDELETE(name: string) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  if (!name) {
    return NextResponse.json({ error: "Monitor name is required" }, { status: 400 });
  }

  const { stdout, stderr, code } = await runEltCli(["sensors", "delete", name]);

  if (!stdout.includes("Deleted sensor")) {
    return NextResponse.json(
      { error: "Failed to delete monitor", details: stderr || stdout || `exit ${code}` },
      { status: 400 }
    );
  }

  return NextResponse.json({
    success: true,
    message: `Monitor '${name}' deleted successfully`,
    output: stdout,
  });
}
