/**
 * Apply sensor component nodes from canvas as EltMonitor rows (Lakeflow trigger model).
 */

import type { Prisma } from "@prisma/client";
import { db } from "@/lib/db/client";
import { connectorMatchesMonitorType } from "@/lib/monitors/monitor-types";
import type { ExtractedCanvasComponents } from "@/lib/elt/canvas-component-sync";

export type ApplyCanvasMonitorsResult = {
  created: string[];
  skipped: string[];
  errors: string[];
};

function defaultMonitorConfig(
  monitorType: string,
  componentConfig: Record<string, unknown>
): Record<string, unknown> {
  const c = { ...componentConfig };
  if (monitorType === "s3_file_count") {
    return {
      bucket_name: c.bucket_name ?? c.bucket ?? "",
      prefix: c.prefix ?? "",
      threshold: Number(c.threshold ?? 1),
      key_pattern: c.key_pattern ?? ".*",
      ...c,
    };
  }
  if (monitorType === "sqs_message_count") {
    return {
      queue_url: c.queue_url ?? c.queueUrl ?? "",
      threshold: Number(c.threshold ?? 1),
      ...c,
    };
  }
  if (monitorType === "gcs_file_arrival") {
    return {
      bucket: c.bucket ?? c.bucket_name ?? "",
      prefix: c.prefix ?? "",
      file_pattern: c.file_pattern ?? ".*",
      ...c,
    };
  }
  return c;
}

/**
 * Upsert monitors suggested by canvas sensor components.
 * Uses pipeline sourceConnectionId when connector matches monitor type.
 */
export async function applyCanvasSensorMonitors(
  userId: string,
  pipelineId: string,
  sourceConnectionId: string | null,
  sensors: ExtractedCanvasComponents["sensorMonitors"]
): Promise<ApplyCanvasMonitorsResult> {
  const result: ApplyCanvasMonitorsResult = { created: [], skipped: [], errors: [] };
  if (!sensors.length) return result;

  let connectionId: string | null = null;
  let connectionConnector: string | null = null;

  if (sourceConnectionId) {
    const conn = await db.connection.findFirst({
      where: { id: sourceConnectionId, userId },
      select: { id: true, connector: true },
    });
    if (conn) {
      connectionId = conn.id;
      connectionConnector = conn.connector;
    }
  }

  for (const sensor of sensors) {
    const monitorName = `canvas_${sensor.componentId}`.slice(0, 120);
    const existing = await db.eltMonitor.findFirst({
      where: { userId, pipelineId, name: monitorName },
    });
    if (existing) {
      result.skipped.push(monitorName);
      continue;
    }

    if (connectionId && connectionConnector) {
      if (!connectorMatchesMonitorType(connectionConnector, sensor.monitorType)) {
        result.errors.push(
          `${monitorName}: source connection (${connectionConnector}) does not match ${sensor.monitorType}`
        );
        continue;
      }
    } else {
      result.skipped.push(`${monitorName} (no matching connection — link source connection on pipeline)`);
      continue;
    }

    const config = defaultMonitorConfig(sensor.monitorType, sensor.config);

    try {
      await db.eltMonitor.create({
        data: {
          userId,
          pipelineId,
          name: monitorName,
          type: sensor.monitorType,
          connectionId,
          executionHost: "inherit",
          config: config as Prisma.InputJsonValue,
        },
      });
      result.created.push(monitorName);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      result.errors.push(`${monitorName}: ${msg}`);
    }
  }

  return result;
}
