import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import type { Connection, EltMonitor } from "@prisma/client";
import { resolveRunTargetAgentTokenId } from "@/lib/agent/gateway-routing";
import { db } from "@/lib/db/client";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import { resolveSensorCheckIntervalSeconds } from "@/lib/plans/agent-schedule";

export type TriggeredSensorRow = {
  sensorName: string;
  pipelineName: string;
  message: string;
  metadata: Record<string, unknown>;
  timestamp: string;
};

/** Plan tier + optional org override → minimum seconds between sensor checks (matches agent manifest). */
async function sensorIntervalSecondsByUserId(userIds: string[]): Promise<Map<string, number>> {
  if (userIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    include: {
      subscription: true,
      ownedOrganization: { select: { sensorPollIntervalSecondsOverride: true } },
    },
  });
  const map = new Map<string, number>();
  for (const u of users) {
    const tier = u.subscription?.tier ?? "free";
    map.set(
      u.id,
      resolveSensorCheckIntervalSeconds({
        planTier: tier,
        organizationSensorOverride: u.ownedOrganization?.sensorPollIntervalSecondsOverride,
      })
    );
  }
  return map;
}

function connectionHints(conn: Pick<Connection, "config">): Record<string, string> {
  const c = conn.config;
  if (!c || typeof c !== "object" || Array.isArray(c)) return {};
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(c as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

function asConfig(config: unknown): Record<string, unknown> {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return config as Record<string, unknown>;
}

async function checkS3FileCount(
  cfg: Record<string, unknown>,
  secrets: Record<string, string>,
  hints: Record<string, string>
): Promise<{ shouldTrigger: boolean; message: string; metadata: Record<string, unknown> }> {
  const bucket = String(cfg.bucket_name ?? "");
  const prefix = String(cfg.prefix ?? "");
  const threshold = Number(cfg.threshold ?? 0);
  const region = String(
    cfg.region ?? secrets.AWS_REGION ?? hints.region ?? hints.AWS_REGION ?? "us-east-1"
  );
  const keyPattern = String(cfg.key_pattern ?? ".*");
  const accessKeyId = secrets.AWS_ACCESS_KEY_ID;
  const secretAccessKey = secrets.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    return { shouldTrigger: false, message: "AWS credentials missing on connection", metadata: {} };
  }
  if (!bucket || !Number.isFinite(threshold)) {
    return { shouldTrigger: false, message: "Invalid S3 monitor config", metadata: {} };
  }

  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  let fileCount = 0;
  let regex: RegExp;
  try {
    regex = new RegExp(keyPattern);
  } catch {
    return { shouldTrigger: false, message: `Invalid key_pattern regex: ${keyPattern}`, metadata: {} };
  }

  let continuationToken: string | undefined;
  do {
    const resp = await client.send(
      new ListObjectsV2Command({
        Bucket: bucket,
        Prefix: prefix,
        ContinuationToken: continuationToken,
      })
    );
    for (const obj of resp.Contents ?? []) {
      if (obj.Key && regex.test(obj.Key)) fileCount += 1;
    }
    continuationToken = resp.IsTruncated ? resp.NextContinuationToken : undefined;
  } while (continuationToken);

  if (fileCount >= threshold) {
    return {
      shouldTrigger: true,
      message: `Found ${fileCount} files (threshold: ${threshold})`,
      metadata: {
        file_count: fileCount,
        bucket,
        prefix,
        key_pattern: keyPattern,
        threshold,
      },
    };
  }
  return {
    shouldTrigger: false,
    message: `Only ${fileCount} files found (need ${threshold})`,
    metadata: { file_count: fileCount },
  };
}

async function checkSqsMessageCount(
  cfg: Record<string, unknown>,
  secrets: Record<string, string>,
  hints: Record<string, string>
): Promise<{ shouldTrigger: boolean; message: string; metadata: Record<string, unknown> }> {
  const queueUrl = String(cfg.queue_url ?? "");
  const threshold = Number(cfg.threshold ?? 0);
  const region = String(
    cfg.region ?? secrets.AWS_REGION ?? hints.region ?? hints.AWS_REGION ?? "us-east-1"
  );
  const accessKeyId = secrets.AWS_ACCESS_KEY_ID;
  const secretAccessKey = secrets.AWS_SECRET_ACCESS_KEY;
  if (!accessKeyId || !secretAccessKey) {
    return { shouldTrigger: false, message: "AWS credentials missing on connection", metadata: {} };
  }
  if (!queueUrl || !Number.isFinite(threshold)) {
    return { shouldTrigger: false, message: "Invalid SQS monitor config", metadata: {} };
  }

  const client = new SQSClient({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });

  const resp = await client.send(
    new GetQueueAttributesCommand({
      QueueUrl: queueUrl,
      AttributeNames: ["ApproximateNumberOfMessages"],
    })
  );
  const messageCount = parseInt(resp.Attributes?.ApproximateNumberOfMessages ?? "0", 10);

  if (messageCount >= threshold) {
    return {
      shouldTrigger: true,
      message: `Found ${messageCount} messages (threshold: ${threshold})`,
      metadata: { message_count: messageCount, queue_url: queueUrl, threshold },
    };
  }
  return {
    shouldTrigger: false,
    message: `Only ${messageCount} messages found (need ${threshold})`,
    metadata: { message_count: messageCount },
  };
}

async function runOneMonitorCheck(
  monitor: EltMonitor & { connection: Connection | null }
): Promise<{ shouldTrigger: boolean; message: string; metadata: Record<string, unknown> }> {
  const cfg = asConfig(monitor.config);
  const type = monitor.type;

  if (type === "csv_row_count") {
    return {
      shouldTrigger: false,
      message: "CSV path monitors run on your machine or agent — not in the cloud scheduler",
      metadata: {},
    };
  }

  if (type === "gcs_file_count" || type === "adls_file_count" || type === "kafka_message_count") {
    return {
      shouldTrigger: false,
      message: `${type} checks are not yet wired in the cloud runner (coming soon)`,
      metadata: {},
    };
  }

  if (!monitor.connection) {
    return {
      shouldTrigger: false,
      message: "Monitor has no linked connection — cannot load credentials",
      metadata: {},
    };
  }

  const secrets = parseStoredConnectionSecrets(monitor.connection.connectionSecretsEnc);
  const hints = connectionHints(monitor.connection);

  if (type === "s3_file_count") {
    return checkS3FileCount(cfg, secrets, hints);
  }
  if (type === "sqs_message_count") {
    return checkSqsMessageCount(cfg, secrets, hints);
  }

  return {
    shouldTrigger: false,
    message: `Unknown monitor type: ${type}`,
    metadata: {},
  };
}

async function enqueuePipelineRun(
  userId: string,
  pipelineName: string,
  monitorName: string
): Promise<{ ok: true; runId: string } | { ok: false; reason: string }> {
  const pipeline = await db.eltPipeline.findFirst({
    where: { userId, name: pipelineName },
    select: { id: true, enabled: true, defaultTargetAgentTokenId: true },
  });
  if (!pipeline) {
    return { ok: false, reason: `Pipeline "${pipelineName}" not found` };
  }
  if (!pipeline.enabled) {
    return { ok: false, reason: `Pipeline "${pipelineName}" is disabled` };
  }

  const targetAgentTokenId = await resolveRunTargetAgentTokenId({
    userId,
    bodyOverride: undefined,
    pipelineDefaultId: pipeline.defaultTargetAgentTokenId,
  });

  const run = await db.eltPipelineRun.create({
    data: {
      userId,
      pipelineId: pipeline.id,
      status: "pending",
      environment: "monitor",
      correlationId: crypto.randomUUID(),
      triggeredBy: `monitor:${monitorName}`,
      targetAgentTokenId,
    },
    select: { id: true },
  });

  return { ok: true, runId: run.id };
}

export async function runMonitorChecksForUser(
  userId: string,
  options?: { pipelineFilter?: string }
): Promise<{
  triggeredSensors: TriggeredSensorRow[];
  errors: string[];
  checked: number;
}> {
  const rows = await db.eltMonitor.findMany({
    where: { userId },
    include: { connection: true },
    orderBy: { name: "asc" },
  });

  const filtered = options?.pipelineFilter
    ? rows.filter((r) => r.pipelineName === options.pipelineFilter)
    : rows;

  const intervalByUser = await sensorIntervalSecondsByUserId(
    Array.from(new Set(filtered.map((r) => r.userId)))
  );

  const triggeredSensors: TriggeredSensorRow[] = [];
  const errors: string[] = [];
  const now = new Date();

  for (const m of filtered) {
    const minSec = intervalByUser.get(m.userId) ?? 600;
    if (m.lastCheckAt) {
      const elapsed = (now.getTime() - m.lastCheckAt.getTime()) / 1000;
      if (elapsed < minSec) {
        continue;
      }
    }
    try {
      const result = await runOneMonitorCheck(m);
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now },
      });

      if (result.shouldTrigger) {
        const q = await enqueuePipelineRun(m.userId, m.pipelineName, m.name);
        if (q.ok) {
          await db.eltMonitor.update({
            where: { id: m.id },
            data: { lastTriggeredAt: now },
          });
          triggeredSensors.push({
            sensorName: m.name,
            pipelineName: m.pipelineName,
            message: result.message,
            metadata: result.metadata,
            timestamp: now.toISOString(),
          });
        } else {
          errors.push(`${m.name}: triggered but run not queued — ${q.reason}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${m.name}: ${msg}`);
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now },
      });
    }
  }

  return { triggeredSensors, errors, checked: filtered.length };
}

/** Cron: evaluate every stored monitor across all users. */
export async function runMonitorChecksForAllUsers(): Promise<{
  triggeredSensors: TriggeredSensorRow[];
  errors: string[];
  users: number;
  monitors: number;
}> {
  const rows = await db.eltMonitor.findMany({
    include: { connection: true },
  });

  const intervalByUser = await sensorIntervalSecondsByUserId(Array.from(new Set(rows.map((r) => r.userId))));

  const triggeredSensors: TriggeredSensorRow[] = [];
  const errors: string[] = [];
  const now = new Date();
  const userIds = new Set<string>();

  for (const m of rows) {
    userIds.add(m.userId);
    const minSec = intervalByUser.get(m.userId) ?? 600;
    if (m.lastCheckAt) {
      const elapsed = (now.getTime() - m.lastCheckAt.getTime()) / 1000;
      if (elapsed < minSec) {
        continue;
      }
    }
    try {
      const result = await runOneMonitorCheck(m);
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now },
      });

      if (result.shouldTrigger) {
        const q = await enqueuePipelineRun(m.userId, m.pipelineName, m.name);
        if (q.ok) {
          await db.eltMonitor.update({
            where: { id: m.id },
            data: { lastTriggeredAt: now },
          });
          triggeredSensors.push({
            sensorName: m.name,
            pipelineName: m.pipelineName,
            message: result.message,
            metadata: result.metadata,
            timestamp: now.toISOString(),
          });
        } else {
          errors.push(`${m.userId}/${m.name}: ${q.reason}`);
        }
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      errors.push(`${m.userId}/${m.name}: ${msg}`);
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now },
      });
    }
  }

  return {
    triggeredSensors,
    errors,
    users: userIds.size,
    monitors: rows.length,
  };
}
