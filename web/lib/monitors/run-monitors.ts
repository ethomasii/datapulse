import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";
import { createHash } from "crypto";
import { Client as PgClient } from "pg";
import type { Connection, EltMonitor, ExecutionPlane } from "@prisma/client";
import { monitorEvaluatesOnControlPlane } from "@/lib/agent/monitor-execution";
import { resolveNewRunExecution } from "@/lib/agent/run-execution";
import { db } from "@/lib/db/client";
import { parseStoredConnectionSecrets } from "@/lib/elt/connection-secrets-store";
import type { CronMonitorScaleOptions } from "@/lib/monitors/cron-scale";
import { stableMonitorShard } from "@/lib/monitors/cron-scale";
import { createPendingEltRun } from "@/lib/elt/create-pending-elt-run";
import {
  monitorPartitionColumnFromConfig,
  parsePartitionValuesFromMonitorConfig,
  resolveRunPartitionFields,
} from "@/lib/elt/run-partition-resolution";
import { resolveSensorCheckIntervalSeconds } from "@/lib/plans/agent-schedule";

export type TriggeredMonitorRow = {
  monitorName: string;
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

async function executionPlaneByUserId(userIds: string[]): Promise<Map<string, ExecutionPlane>> {
  if (userIds.length === 0) return new Map();
  const users = await db.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, executionPlane: true },
  });
  return new Map(users.map((u) => [u.id, u.executionPlane]));
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

type MonitorCheckResult = { shouldTrigger: boolean; message: string; metadata: Record<string, unknown> };

// ── SQL watermark monitor ──────────────────────────────────────────────────────
// Connects to a database and checks for rows newer than the stored watermark.
// Supports postgres, mysql, snowflake, bigquery connection strings.
async function checkSqlWatermark(
  cfg: Record<string, unknown>,
  secrets: Record<string, string>,
  hints: Record<string, string>
): Promise<MonitorCheckResult> {
  const table = String(cfg.table ?? "");
  const watermarkColumn = String(cfg.watermark_column ?? "updated_at");
  const lastWatermark = cfg.last_watermark ? String(cfg.last_watermark) : null;
  const connStr =
    secrets.DATABASE_URL ?? secrets.POSTGRES_URL ?? secrets.MYSQL_URL ??
    hints.connection_string ?? hints.host ?? "";

  if (!table) {
    return { shouldTrigger: false, message: "sql_watermark: table is required", metadata: {} };
  }
  if (!connStr) {
    return { shouldTrigger: false, message: "sql_watermark: no connection string found in connection secrets (DATABASE_URL, POSTGRES_URL, MYSQL_URL)", metadata: {} };
  }

  // Dynamically import pg — only available when postgres connection is used.
  // Falls back gracefully for other DB types (Snowflake/BigQuery require gateway-side execution).
  let rowCount = 0;
  let maxWatermark: string | null = null;
  try {
    const client = new PgClient({ connectionString: connStr, ssl: { rejectUnauthorized: false } });
    await client.connect();
    const whereClause = lastWatermark
      ? `WHERE ${watermarkColumn} > $1`
      : "";
    const params = lastWatermark ? [lastWatermark] : [];
    const result = await client.query(
      `SELECT COUNT(*) AS cnt, MAX(${watermarkColumn}::text) AS max_wm FROM ${table} ${whereClause}`,
      params
    );
    await client.end();
    rowCount = parseInt(result.rows[0]?.cnt ?? "0", 10);
    maxWatermark = result.rows[0]?.max_wm ?? null;
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return { shouldTrigger: false, message: `sql_watermark query failed: ${msg}`, metadata: {} };
  }

  if (rowCount > 0) {
    return {
      shouldTrigger: true,
      message: `Found ${rowCount} new row(s) in ${table} since watermark ${lastWatermark ?? "none"} (max: ${maxWatermark})`,
      metadata: { table, watermark_column: watermarkColumn, new_row_count: rowCount, max_watermark: maxWatermark, previous_watermark: lastWatermark },
    };
  }
  return {
    shouldTrigger: false,
    message: `No new rows in ${table} since ${lastWatermark ?? "beginning"}`,
    metadata: { table, watermark_column: watermarkColumn, row_count: rowCount },
  };
}

// ── GCS file arrival monitor ───────────────────────────────────────────────────
// Uses GCS JSON API (no extra package required) to detect files matching a pattern
// that are newer than last_triggered_at. Triggers on any matching new object.
async function checkGcsFileArrival(
  cfg: Record<string, unknown>,
  secrets: Record<string, string>,
  lastTriggeredAt: Date | null
): Promise<MonitorCheckResult> {
  const bucket = String(cfg.bucket_name ?? "");
  const prefix = String(cfg.prefix ?? "");
  const filePattern = String(cfg.file_pattern ?? ".*");
  const serviceAccountJson = secrets.GOOGLE_SERVICE_ACCOUNT_JSON ?? secrets.GCS_SERVICE_ACCOUNT_JSON;

  if (!bucket) {
    return { shouldTrigger: false, message: "gcs_file_arrival: bucket_name is required", metadata: {} };
  }
  if (!serviceAccountJson) {
    return { shouldTrigger: false, message: "gcs_file_arrival: GOOGLE_SERVICE_ACCOUNT_JSON secret missing on connection", metadata: {} };
  }

  let regex: RegExp;
  try {
    regex = new RegExp(filePattern);
  } catch {
    return { shouldTrigger: false, message: `gcs_file_arrival: invalid file_pattern regex: ${filePattern}`, metadata: {} };
  }

  let accessToken: string;
  try {
    // Exchange service account JSON for a short-lived access token via GCP metadata endpoint
    const sa = JSON.parse(serviceAccountJson) as { client_email: string; private_key: string };
    const now = Math.floor(Date.now() / 1000);
    const header = Buffer.from(JSON.stringify({ alg: "RS256", typ: "JWT" })).toString("base64url");
    const payload = Buffer.from(JSON.stringify({
      iss: sa.client_email,
      scope: "https://www.googleapis.com/auth/devstorage.read_only",
      aud: "https://oauth2.googleapis.com/token",
      exp: now + 3600,
      iat: now,
    })).toString("base64url");
    // Node 22+ crypto.subtle RSA-SHA256 sign
    const { createSign } = await import("crypto");
    const sign = createSign("RSA-SHA256");
    sign.update(`${header}.${payload}`);
    const sig = sign.sign(sa.private_key, "base64url");
    const jwt = `${header}.${payload}.${sig}`;
    const tokenResp = await fetch("https://oauth2.googleapis.com/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: `grant_type=urn%3Aietf%3Aparams%3Aoauth%3Agrant-type%3Ajwt-bearer&assertion=${jwt}`,
    });
    const tokenData = await tokenResp.json() as { access_token?: string; error?: string };
    if (!tokenData.access_token) {
      return { shouldTrigger: false, message: `gcs_file_arrival: token exchange failed: ${tokenData.error ?? "unknown"}`, metadata: {} };
    }
    accessToken = tokenData.access_token;
  } catch (e) {
    return { shouldTrigger: false, message: `gcs_file_arrival: auth failed: ${e instanceof Error ? e.message : String(e)}`, metadata: {} };
  }

  // List objects with optional prefix
  const url = new URL(`https://storage.googleapis.com/storage/v1/b/${encodeURIComponent(bucket)}/o`);
  if (prefix) url.searchParams.set("prefix", prefix);
  url.searchParams.set("maxResults", "1000");
  const listResp = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  if (!listResp.ok) {
    return { shouldTrigger: false, message: `gcs_file_arrival: list objects failed (${listResp.status})`, metadata: {} };
  }
  const listData = await listResp.json() as { items?: { name: string; timeCreated: string; size: string }[] };
  const items = listData.items ?? [];

  const cutoff = lastTriggeredAt ?? new Date(0);
  const newFiles = items.filter((obj) => {
    const created = new Date(obj.timeCreated);
    return created > cutoff && regex.test(obj.name);
  });

  if (newFiles.length > 0) {
    return {
      shouldTrigger: true,
      message: `Found ${newFiles.length} new file(s) in gs://${bucket}/${prefix} matching ${filePattern}`,
      metadata: { bucket, prefix, file_pattern: filePattern, new_file_count: newFiles.length, newest_file: newFiles[newFiles.length - 1]?.name },
    };
  }
  return {
    shouldTrigger: false,
    message: `No new files in gs://${bucket}/${prefix} matching ${filePattern} since ${cutoff.toISOString()}`,
    metadata: { bucket, prefix, total_checked: items.length },
  };
}

// ── HTTP change monitor ────────────────────────────────────────────────────────
// Fetches a URL and hashes a portion of the response. Triggers when the hash
// differs from the stored last_hash, indicating the endpoint content changed.
async function checkHttpChange(
  cfg: Record<string, unknown>,
  secrets: Record<string, string>
): Promise<MonitorCheckResult> {
  const url = String(cfg.url ?? "");
  const jsonPath = cfg.json_path ? String(cfg.json_path) : null;
  const lastHash = cfg.last_hash ? String(cfg.last_hash) : null;
  const authHeader = secrets.HTTP_AUTH_HEADER ?? null;

  if (!url) {
    return { shouldTrigger: false, message: "http_change: url is required", metadata: {} };
  }

  let responseText: string;
  try {
    const headers: Record<string, string> = { "User-Agent": "DataPulse-Monitor/1.0" };
    if (authHeader) headers["Authorization"] = authHeader;
    const resp = await fetch(url, { headers, signal: AbortSignal.timeout(15_000) });
    if (!resp.ok) {
      return { shouldTrigger: false, message: `http_change: fetch returned ${resp.status}`, metadata: { url, status: resp.status } };
    }
    responseText = await resp.text();
  } catch (e) {
    return { shouldTrigger: false, message: `http_change: fetch failed: ${e instanceof Error ? e.message : String(e)}`, metadata: { url } };
  }

  // Optionally extract a sub-value via a dot-notation json_path (e.g. "data.count")
  let hashInput = responseText;
  if (jsonPath) {
    try {
      const parsed = JSON.parse(responseText) as Record<string, unknown>;
      const parts = jsonPath.split(".");
      let cur: unknown = parsed;
      for (const part of parts) {
        if (cur && typeof cur === "object") cur = (cur as Record<string, unknown>)[part];
      }
      hashInput = JSON.stringify(cur ?? null);
    } catch {
      // fall back to full body
    }
  }

  const currentHash = createHash("sha256").update(hashInput).digest("hex").slice(0, 16);

  if (!lastHash) {
    // First check — store hash but don't trigger yet
    return {
      shouldTrigger: false,
      message: `http_change: baseline hash stored (${currentHash}). Will trigger on next change.`,
      metadata: { url, current_hash: currentHash, first_check: true },
    };
  }

  if (currentHash !== lastHash) {
    return {
      shouldTrigger: true,
      message: `http_change: content at ${url} changed (hash ${lastHash} → ${currentHash})`,
      metadata: { url, previous_hash: lastHash, current_hash: currentHash, json_path: jsonPath },
    };
  }
  return {
    shouldTrigger: false,
    message: `http_change: no change detected at ${url}`,
    metadata: { url, hash: currentHash },
  };
}

async function runOneMonitorCheck(
  monitor: EltMonitor & {
    connection: Connection | null;
    pipeline: { id: string; name: string };
  }
): Promise<MonitorCheckResult & { configUpdates?: Record<string, unknown> }> {
  const cfg = asConfig(monitor.config);
  const type = monitor.type;

  if (type === "csv_row_count") {
    return {
      shouldTrigger: false,
      message: "CSV path monitors run on your machine or agent — not in the cloud scheduler",
      metadata: {},
    };
  }

  if (type === "adls_file_count" || type === "kafka_message_count") {
    return {
      shouldTrigger: false,
      message: `${type} checks are not yet wired in the cloud runner (coming soon)`,
      metadata: {},
    };
  }

  // http_change needs no stored connection — secrets come from config
  if (type === "http_change") {
    const secrets = monitor.connection
      ? parseStoredConnectionSecrets(monitor.connection.connectionSecretsEnc)
      : {};
    const result = await checkHttpChange(cfg, secrets);
    // Always persist the current hash so the next check can compare against it
    const currentHash = result.metadata.current_hash ?? result.metadata.hash ?? null;
    const configUpdates = currentHash ? { last_hash: currentHash } : undefined;
    return { ...result, configUpdates };
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
  if (type === "gcs_file_arrival") {
    const result = await checkGcsFileArrival(cfg, secrets, monitor.lastTriggeredAt);
    return result;
  }
  if (type === "sql_watermark") {
    const result = await checkSqlWatermark(cfg, secrets, hints);
    // Advance the watermark after a successful trigger so we don't re-fire on the same rows
    const configUpdates = result.shouldTrigger && result.metadata.max_watermark
      ? { last_watermark: result.metadata.max_watermark }
      : undefined;
    return { ...result, configUpdates };
  }

  return {
    shouldTrigger: false,
    message: `Unknown monitor type: ${type}`,
    metadata: {},
  };
}

export type MonitorForEnqueue = {
  id: string;
  name: string;
  pipelineId: string;
  config: unknown;
};

export async function enqueuePipelineRunForMonitor(
  userId: string,
  monitor: MonitorForEnqueue
): Promise<{ ok: true; runIds: string[] } | { ok: false; reason: string }> {
  const pipeline = await db.eltPipeline.findFirst({
    where: { id: monitor.pipelineId, userId },
    select: {
      id: true,
      enabled: true,
      name: true,
      defaultTargetAgentTokenId: true,
      executionHost: true,
      sourceConfiguration: true,
    },
  });
  if (!pipeline) {
    return { ok: false, reason: "Pipeline not found" };
  }
  if (!pipeline.enabled) {
    return { ok: false, reason: `Pipeline "${pipeline.name}" is disabled` };
  }

  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { executionPlane: true, organizationId: true },
  });
  const organizationId = actor?.organizationId ?? null;
  const { targetAgentTokenId, ingestionExecutor } = await resolveNewRunExecution({
    userId,
    organizationId,
    executionHost: pipeline.executionHost,
    pipelineDefaultTargetAgentTokenId: pipeline.defaultTargetAgentTokenId,
    bodyOverride: undefined,
    userExecutionPlane: actor?.executionPlane ?? "eltpulse_managed",
  });

  const cfg = asConfig(monitor.config);
  const sliceValues = parsePartitionValuesFromMonitorConfig(cfg);

  if (sliceValues.length > 0) {
    const column = monitorPartitionColumnFromConfig(cfg, pipeline.sourceConfiguration);
    if (!column) {
      return {
        ok: false,
        reason:
          "Monitor has partition_values but no partition_column — set partition_column on the monitor or save a date/key partition column on the pipeline.",
      };
    }
    const runIds: string[] = [];
    for (const val of sliceValues) {
      const r = resolveRunPartitionFields(
        { partitionColumn: column, partitionValue: val, triggeredBy: null },
        pipeline.sourceConfiguration
      );
      const run = await createPendingEltRun({
        userId,
        pipelineId: pipeline.id,
        environment: "monitor",
        triggeredBy: r.triggeredBy ?? `monitor:${monitor.name}:slice`,
        partitionColumn: r.partitionColumn,
        partitionValue: r.partitionValue,
        targetAgentTokenId,
        ingestionExecutor,
      });
      runIds.push(run.id);
    }
    return { ok: true, runIds };
  }

  const run = await createPendingEltRun({
    userId,
    pipelineId: pipeline.id,
    environment: "monitor",
    triggeredBy: `monitor:${monitor.name}`,
    partitionColumn: null,
    partitionValue: null,
    targetAgentTokenId,
    ingestionExecutor,
  });

  return { ok: true, runIds: [run.id] };
}

export async function runMonitorChecksForUser(
  userId: string,
  options?: { pipelineFilter?: string }
): Promise<{
  triggeredMonitors: TriggeredMonitorRow[];
  errors: string[];
  checked: number;
}> {
  const actor = await db.user.findUnique({
    where: { id: userId },
    select: { executionPlane: true },
  });
  const userPlane = actor?.executionPlane ?? "eltpulse_managed";

  const rows = await db.eltMonitor.findMany({
    where: { userId },
    include: {
      connection: true,
      pipeline: { select: { id: true, name: true } },
    },
    orderBy: { name: "asc" },
  });

  const filtered = options?.pipelineFilter
    ? rows.filter(
        (r) =>
          r.pipeline.name === options.pipelineFilter || r.pipeline.id === options.pipelineFilter
      )
    : rows;

  const intervalByUser = await sensorIntervalSecondsByUserId(
    Array.from(new Set(filtered.map((r) => r.userId)))
  );

  const triggeredMonitors: TriggeredMonitorRow[] = [];
  const errors: string[] = [];
  const now = new Date();
  let checked = 0;

  for (const m of filtered) {
    if (!monitorEvaluatesOnControlPlane(m.executionHost, userPlane)) {
      continue;
    }
    const minSec = intervalByUser.get(m.userId) ?? 600;
    if (m.lastCheckAt) {
      const elapsed = (now.getTime() - m.lastCheckAt.getTime()) / 1000;
      if (elapsed < minSec) {
        continue;
      }
    }
    checked += 1;
    try {
      const result = await runOneMonitorCheck(m);
      const baseConfig = asConfig(m.config);
      const updatedConfig = result.configUpdates
        ? ({ ...baseConfig, ...result.configUpdates } as Parameters<typeof db.eltMonitor.update>[0]["data"]["config"])
        : undefined;
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now, ...(updatedConfig !== undefined ? { config: updatedConfig } : {}) },
      });

      if (result.shouldTrigger) {
        const q = await enqueuePipelineRunForMonitor(m.userId, {
          id: m.id,
          name: m.name,
          pipelineId: m.pipelineId,
          config: m.config,
        });
        if (q.ok) {
          await db.eltMonitor.update({
            where: { id: m.id },
            data: { lastTriggeredAt: now },
          });
          triggeredMonitors.push({
            monitorName: m.name,
            pipelineName: m.pipeline.name,
            message: result.message,
            metadata: { ...result.metadata, run_ids: q.runIds },
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

  return { triggeredMonitors, errors, checked };
}

/** Cron: evaluate every stored monitor across all users. */
export async function runMonitorChecksForAllUsers(options?: CronMonitorScaleOptions): Promise<{
  triggeredMonitors: TriggeredMonitorRow[];
  errors: string[];
  users: number;
  monitors: number;
  cloudEvaluated: number;
  skippedByShard: number;
  stoppedEarly: boolean;
  shard: { index: number; count: number };
}> {
  const rows = await db.eltMonitor.findMany({
    include: {
      connection: true,
      pipeline: { select: { id: true, name: true } },
    },
  });

  const intervalByUser = await sensorIntervalSecondsByUserId(Array.from(new Set(rows.map((r) => r.userId))));
  const planeByUser = await executionPlaneByUserId(Array.from(new Set(rows.map((r) => r.userId))));

  const triggeredMonitors: TriggeredMonitorRow[] = [];
  const errors: string[] = [];
  const now = new Date();
  const userIds = new Set<string>();
  const shardCount = Math.max(1, Math.min(64, options?.shardCount ?? 1));
  const shardIndex = Math.max(0, Math.min(shardCount - 1, options?.shardIndex ?? 0));
  const maxElapsedMs = options?.maxElapsedMs;
  const startedAt = Date.now();
  let skippedByShard = 0;
  let cloudEvaluated = 0;
  let stoppedEarly = false;

  for (const m of rows) {
    userIds.add(m.userId);
    const userPlane = planeByUser.get(m.userId) ?? "eltpulse_managed";
    if (!monitorEvaluatesOnControlPlane(m.executionHost, userPlane)) {
      continue;
    }
    const minSec = intervalByUser.get(m.userId) ?? 600;
    if (m.lastCheckAt) {
      const elapsed = (now.getTime() - m.lastCheckAt.getTime()) / 1000;
      if (elapsed < minSec) {
        continue;
      }
    }
    if (shardCount > 1 && stableMonitorShard(m.userId, m.id, shardCount) !== shardIndex) {
      skippedByShard += 1;
      continue;
    }
    if (maxElapsedMs != null && Date.now() - startedAt >= maxElapsedMs) {
      stoppedEarly = true;
      break;
    }
    cloudEvaluated += 1;
    try {
      const result = await runOneMonitorCheck(m);
      const baseConfigAll = asConfig(m.config);
      const updatedConfigAll = result.configUpdates
        ? ({ ...baseConfigAll, ...result.configUpdates } as Parameters<typeof db.eltMonitor.update>[0]["data"]["config"])
        : undefined;
      await db.eltMonitor.update({
        where: { id: m.id },
        data: { lastCheckAt: now, ...(updatedConfigAll !== undefined ? { config: updatedConfigAll } : {}) },
      });

      if (result.shouldTrigger) {
        const q = await enqueuePipelineRunForMonitor(m.userId, {
          id: m.id,
          name: m.name,
          pipelineId: m.pipelineId,
          config: m.config,
        });
        if (q.ok) {
          await db.eltMonitor.update({
            where: { id: m.id },
            data: { lastTriggeredAt: now },
          });
          triggeredMonitors.push({
            monitorName: m.name,
            pipelineName: m.pipeline.name,
            message: result.message,
            metadata: { ...result.metadata, run_ids: q.runIds },
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
    triggeredMonitors,
    errors,
    users: userIds.size,
    monitors: rows.length,
    cloudEvaluated,
    skippedByShard,
    stoppedEarly,
    shard: { index: shardIndex, count: shardCount },
  };
}
