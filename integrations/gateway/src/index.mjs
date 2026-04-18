/**
 * eltPulse gateway (Node 20+): control-plane poller, optional inline or spawned pipeline/monitor workers.
 *
 * Required env:
 *   ELTPULSE_AGENT_TOKEN, ELTPULSE_CONTROL_PLANE_URL
 *
 * Worker modes (one-shot, then exit — use from ECS task / K8s Job / docker run):
 *   ELTPULSE_SINGLE_RUN_ID=<id>       Execute one pending pipeline run (stub completion) then exit.
 *   ELTPULSE_SINGLE_MONITOR_ID=<id>   Evaluate one gateway-side monitor (S3/SQS) and POST report, then exit.
 *
 * Optional:
 *   ELTPULSE_EXECUTE_RUNS=1           Poll loop: claim runs (required for dispatcher inline path).
 *   ELTPULSE_EVAL_MONITORS=0            Disable monitor polling in the long-lived dispatcher.
 *   ELTPULSE_GATEWAY_IDLE_EXIT_POLLS=N  After N consecutive polls with **zero** pending customer-gateway runs, exit(0).
 *                                       Use with cron/`docker run`: process starts, drains queue, stops — no K8s Job required.
 *
 * Isolation (dispatcher only; env overrides manifest.executorHints from named token metadata):
 *   ELTPULSE_PIPELINE_RUN_ISOLATION=inline|spawn
 *   ELTPULSE_MONITOR_CHECK_ISOLATION=inline|spawn
 *   ELTPULSE_PIPELINE_RUN_SPAWN_COMMAND   Shell command; templates: {{RUN_ID}}, {{CONTROL_PLANE_URL}}
 *   ELTPULSE_PIPELINE_RUN_DOCKER_IMAGE    If set (and no SPAWN_COMMAND), runs: docker run ... with single-run worker.
 *   ELTPULSE_MONITOR_CHECK_SPAWN_COMMAND  Templates: {{MONITOR_ID}}, {{CONTROL_PLANE_URL}}
 *   ELTPULSE_MONITOR_CHECK_DOCKER_IMAGE   Same pattern for one monitor evaluation.
 */

import { spawn } from "node:child_process";
import { ListObjectsV2Command, S3Client } from "@aws-sdk/client-s3";
import { GetQueueAttributesCommand, SQSClient } from "@aws-sdk/client-sqs";

const baseUrl = (process.env.ELTPULSE_CONTROL_PLANE_URL || "").replace(/\/$/, "");
const token = process.env.ELTPULSE_AGENT_TOKEN || "";
const executeRuns = ["1", "true", "yes"].includes(
  String(process.env.ELTPULSE_EXECUTE_RUNS || "").toLowerCase()
);
const evalMonitors = !["0", "false", "no"].includes(
  String(process.env.ELTPULSE_EVAL_MONITORS ?? "1").toLowerCase()
);

/** >0: exit after this many consecutive polls with no pending customer-gateway runs (ephemeral / scale-to-zero). */
const idleExitAfterEmptyRunPolls = Math.max(
  0,
  Number(process.env.ELTPULSE_GATEWAY_IDLE_EXIT_POLLS || "") || 0
);
let consecutiveEmptyCustomerRunPolls = 0;

function maybeIdleExitAfterEmptyRunPoll() {
  if (idleExitAfterEmptyRunPolls <= 0 || !executeRuns) return;
  consecutiveEmptyCustomerRunPolls += 1;
  if (consecutiveEmptyCustomerRunPolls >= idleExitAfterEmptyRunPolls) {
    console.log(
      `[eltpulse-gateway] exiting after ${idleExitAfterEmptyRunPolls} consecutive empty customer run polls (ELTPULSE_GATEWAY_IDLE_EXIT_POLLS)`
    );
    process.exit(0);
  }
}

function resetCustomerRunPollIdle() {
  consecutiveEmptyCustomerRunPolls = 0;
}

const singleRunId = process.env.ELTPULSE_SINGLE_RUN_ID?.trim() || "";
const singleMonitorId = process.env.ELTPULSE_SINGLE_MONITOR_ID?.trim() || "";

if (!baseUrl || !token) {
  console.error("Missing ELTPULSE_CONTROL_PLANE_URL or ELTPULSE_AGENT_TOKEN");
  process.exit(1);
}

if (singleRunId && singleMonitorId) {
  console.error("Use only one of ELTPULSE_SINGLE_RUN_ID or ELTPULSE_SINGLE_MONITOR_ID");
  process.exit(1);
}

/** @type {{ runsPoll: number, heartbeat: number, sensorCheck: number } | null} */
let intervals = null;
/** @type {any} */
let lastManifest = null;

async function api(path, { method = "GET", json } = {}) {
  const url = `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
  const headers = {
    Authorization: `Bearer ${token}`,
    Accept: "application/json",
  };
  if (json !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(url, {
    method,
    headers,
    body: json !== undefined ? JSON.stringify(json) : undefined,
  });
  const text = await res.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = { _raw: text };
  }
  if (!res.ok) {
    const err = new Error(`${method} ${path} -> ${res.status}`);
    err.detail = body;
    throw err;
  }
  return body;
}

function monitorEvaluatesOnControlPlane(executionHost, executionPlane) {
  if (executionHost === "eltpulse_managed") return true;
  if (executionHost === "customer_gateway") return false;
  const managed =
    executionPlane === "eltpulse_managed" || executionPlane === "datapulse_managed";
  return managed;
}

function envIsolation(name) {
  const v = String(process.env[name] || "").toLowerCase();
  if (v === "spawn" || v === "inline") return v;
  return null;
}

function effectivePipelineIsolation() {
  return envIsolation("ELTPULSE_PIPELINE_RUN_ISOLATION") ?? lastManifest?.executorHints?.pipelineRunIsolation ?? "inline";
}

function effectiveMonitorIsolation() {
  return (
    envIsolation("ELTPULSE_MONITOR_CHECK_ISOLATION") ?? lastManifest?.executorHints?.monitorCheckIsolation ?? "inline"
  );
}

function substituteSpawnTemplate(cmd, vars) {
  let out = cmd;
  for (const [k, v] of Object.entries(vars)) {
    out = out.split(`{{${k}}}`).join(v);
  }
  return out;
}

function spawnDetachedShell(command) {
  const child = spawn(command, {
    shell: true,
    stdio: "ignore",
    detached: true,
    env: process.env,
  });
  child.unref();
}

function spawnDockerSingleRun(runId, image) {
  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `ELTPULSE_SINGLE_RUN_ID=${runId}`,
      "-e",
      "ELTPULSE_AGENT_TOKEN",
      "-e",
      "ELTPULSE_CONTROL_PLANE_URL",
      image,
      "node",
      "src/index.mjs",
    ],
    { stdio: "ignore", detached: true, env: process.env }
  );
  child.unref();
}

function spawnDockerSingleMonitor(monitorId, image) {
  const child = spawn(
    "docker",
    [
      "run",
      "--rm",
      "-e",
      `ELTPULSE_SINGLE_MONITOR_ID=${monitorId}`,
      "-e",
      "ELTPULSE_AGENT_TOKEN",
      "-e",
      "ELTPULSE_CONTROL_PLANE_URL",
      image,
      "node",
      "src/index.mjs",
    ],
    { stdio: "ignore", detached: true, env: process.env }
  );
  child.unref();
}

/**
 * @returns {boolean} true if a spawn was started
 */
function trySpawnPipelineRun(runId) {
  const cmdRaw = process.env.ELTPULSE_PIPELINE_RUN_SPAWN_COMMAND?.trim();
  const dockerImage = process.env.ELTPULSE_PIPELINE_RUN_DOCKER_IMAGE?.trim();
  if (cmdRaw) {
    const cmd = substituteSpawnTemplate(cmdRaw, { RUN_ID: runId, CONTROL_PLANE_URL: baseUrl });
    console.log(`[eltpulse-gateway] spawning pipeline run ${runId} (shell)`);
    spawnDetachedShell(cmd);
    return true;
  }
  if (dockerImage) {
    console.log(`[eltpulse-gateway] spawning pipeline run ${runId} (docker ${dockerImage})`);
    spawnDockerSingleRun(runId, dockerImage);
    return true;
  }
  console.error(
    `[eltpulse-gateway] pipelineRunIsolation=spawn but neither ELTPULSE_PIPELINE_RUN_SPAWN_COMMAND nor ELTPULSE_PIPELINE_RUN_DOCKER_IMAGE is set — run ${runId} left pending`
  );
  return false;
}

/**
 * @returns {boolean}
 */
function trySpawnMonitorCheck(monitorId) {
  const cmdRaw = process.env.ELTPULSE_MONITOR_CHECK_SPAWN_COMMAND?.trim();
  const dockerImage = process.env.ELTPULSE_MONITOR_CHECK_DOCKER_IMAGE?.trim();
  if (cmdRaw) {
    const cmd = substituteSpawnTemplate(cmdRaw, { MONITOR_ID: monitorId, CONTROL_PLANE_URL: baseUrl });
    console.log(`[eltpulse-gateway] spawning monitor check ${monitorId} (shell)`);
    spawnDetachedShell(cmd);
    return true;
  }
  if (dockerImage) {
    console.log(`[eltpulse-gateway] spawning monitor check ${monitorId} (docker ${dockerImage})`);
    spawnDockerSingleMonitor(monitorId, dockerImage);
    return true;
  }
  console.error(
    `[eltpulse-gateway] monitorCheckIsolation=spawn but neither ELTPULSE_MONITOR_CHECK_SPAWN_COMMAND nor ELTPULSE_MONITOR_CHECK_DOCKER_IMAGE is set — skipping monitor ${monitorId}`
  );
  return false;
}

async function stubCompleteRun(id) {
  await api(`/api/agent/runs/${id}`, {
    method: "PATCH",
    json: {
      status: "running",
      appendLog: {
        level: "info",
        message:
          "eltpulse-gateway: marking running — replace stubCompleteRun with your ELT executor or use spawn isolation.",
      },
      telemetrySummary: { currentPhase: "stub", progress: 10, rowsLoaded: 0, bytesLoaded: 0 },
      appendTelemetrySample: { progress: 10, rows: 0, bytes: 0, phase: "stub" },
    },
  });
  await api(`/api/agent/runs/${id}`, {
    method: "PATCH",
    json: {
      status: "running",
      telemetrySummary: { currentPhase: "stub", progress: 80, rowsLoaded: 100, bytesLoaded: 50_000 },
      appendTelemetrySample: { progress: 80, rows: 100, bytes: 50_000, phase: "stub" },
    },
  });
  await api(`/api/agent/runs/${id}`, {
    method: "PATCH",
    json: {
      status: "succeeded",
      appendLog: {
        level: "info",
        message: "eltpulse-gateway: completed as succeeded (stub / worker).",
      },
      telemetrySummary: { currentPhase: "done", progress: 100, rowsLoaded: 100, bytesLoaded: 50_000 },
      appendTelemetrySample: { progress: 100, rows: 100, bytes: 50_000, phase: "done" },
    },
  });
  console.log(`[eltpulse-gateway] completed run ${id}`);
}

async function runSinglePipelineWorker(runId) {
  const data = await api("/api/agent/runs?status=pending,running&limit=50");
  const runs = Array.isArray(data.runs) ? data.runs : [];
  const run = runs.find((r) => r.id === runId);
  if (!run) {
    throw new Error(
      `Run ${runId} not found in pending/running for this token (wrong gateway target or run already finished?)`
    );
  }
  await stubCompleteRun(runId);
}

function asConfig(config) {
  if (!config || typeof config !== "object" || Array.isArray(config)) return {};
  return config;
}

function connectionHints(config) {
  const c = asConfig(config);
  const out = {};
  for (const [k, v] of Object.entries(c)) {
    if (typeof v === "string" && v.trim()) out[k] = v;
    else if (typeof v === "number" || typeof v === "boolean") out[k] = String(v);
  }
  return out;
}

async function evalS3FileCount(cfg, secrets, hints) {
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
  let regex;
  try {
    regex = new RegExp(keyPattern);
  } catch {
    return { shouldTrigger: false, message: `Invalid key_pattern regex: ${keyPattern}`, metadata: {} };
  }
  const client = new S3Client({
    region,
    credentials: { accessKeyId, secretAccessKey },
  });
  let fileCount = 0;
  let continuationToken;
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
      metadata: { file_count: fileCount, bucket, prefix, key_pattern: keyPattern, threshold },
    };
  }
  return {
    shouldTrigger: false,
    message: `Only ${fileCount} files found (need ${threshold})`,
    metadata: { file_count: fileCount },
  };
}

async function evalSqsMessageCount(cfg, secrets, hints) {
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

async function runSingleMonitorWorker(monitorId) {
  const m = await api("/api/agent/manifest");
  const plane = m.billing?.executionPlane ?? "eltpulse_managed";
  const monitors = m?.workloads?.monitors;
  if (!Array.isArray(monitors)) throw new Error("No monitors in manifest");
  const mon = monitors.find((x) => x.id === monitorId);
  if (!mon) throw new Error(`Monitor ${monitorId} not in manifest`);
  const host = mon.executionHost ?? "inherit";
  if (monitorEvaluatesOnControlPlane(host, plane)) {
    throw new Error("Monitor is eltPulse-managed for evaluation; refusing single-monitor worker");
  }
  if (mon.type !== "s3_file_count" && mon.type !== "sqs_message_count") {
    throw new Error(`Monitor type ${mon.type} not supported in gateway worker (S3/SQS only)`);
  }
  if (!mon.connectionId) throw new Error("Monitor has no connectionId");

  const data = await api("/api/agent/connections");
  const conns = Array.isArray(data.connections) ? data.connections : [];
  const conn = conns.find((c) => c.id === mon.connectionId);
  if (!conn) throw new Error("Connection not found for monitor");

  const cfg = asConfig(mon.config);
  const secrets =
    conn.secrets && typeof conn.secrets === "object" && !Array.isArray(conn.secrets) ? conn.secrets : {};
  const hints = connectionHints(conn.config);
  const result =
    mon.type === "s3_file_count"
      ? await evalS3FileCount(cfg, secrets, hints)
      : await evalSqsMessageCount(cfg, secrets, hints);

  await api(`/api/agent/monitors/${encodeURIComponent(mon.id)}/report`, {
    method: "POST",
    json: {
      shouldTrigger: result.shouldTrigger,
      message: result.message,
      metadata: result.metadata,
    },
  });
  console.log(`[eltpulse-gateway] single-monitor ${mon.name} reported shouldTrigger=${result.shouldTrigger}`);
}

async function refreshManifest() {
  const m = await api("/api/agent/manifest");
  lastManifest = m;
  const billing = m.billing || {};
  const runsPoll = Math.max(3, Math.min(120, Number(billing.runsPollIntervalSeconds) || 5));
  const heartbeat = Math.max(5, Math.min(300, Number(billing.heartbeatIntervalSeconds) || 30));
  const sensorCheck = Math.max(30, Math.min(3600, Number(billing.sensorCheckIntervalSeconds) || 600));
  intervals = { runsPoll, heartbeat, sensorCheck };
  const pipeIso = effectivePipelineIsolation();
  const monIso = effectiveMonitorIsolation();
  console.log(
    `[eltpulse-gateway] manifest v${m.version} runsPoll=${runsPoll}s heartbeat=${heartbeat}s sensorCheck=${sensorCheck}s ` +
      `executeRuns=${executeRuns} evalMonitors=${evalMonitors} pipelineIsolation=${pipeIso} monitorIsolation=${monIso}`
  );
  return m;
}

async function sendHeartbeat() {
  await api("/api/agent/heartbeat", {
    method: "POST",
    json: {
      version: "eltpulse-gateway/0.3.0",
      labels: { runtime: "node", package: "integrations/gateway" },
    },
  });
}

async function pollRunsOnce() {
  const data = await api("/api/agent/runs?status=pending&limit=5");
  const runs = Array.isArray(data.runs) ? data.runs : [];
  if (runs.length === 0) {
    maybeIdleExitAfterEmptyRunPoll();
    return;
  }
  resetCustomerRunPollIdle();
  console.log(`[eltpulse-gateway] pending runs: ${runs.length}`);
  if (!executeRuns) return;

  const isolation = effectivePipelineIsolation();

  for (const run of runs) {
    const id = run.id;
    if (!id) continue;
    if (isolation === "spawn") {
      trySpawnPipelineRun(id);
      continue;
    }
    await stubCompleteRun(id);
  }
}

async function pollMonitorsOnce() {
  if (!evalMonitors) return;
  const m = lastManifest;
  const monitors = m?.workloads?.monitors;
  if (!Array.isArray(monitors) || monitors.length === 0) return;

  const plane = m.billing?.executionPlane ?? "eltpulse_managed";
  const minSec =
    intervals?.sensorCheck ??
    Math.max(30, Math.min(3600, Number(m.billing?.sensorCheckIntervalSeconds) || 600));
  const now = Date.now();
  const isolation = effectiveMonitorIsolation();

  const data = await api("/api/agent/connections");
  const conns = Array.isArray(data.connections) ? data.connections : [];
  const byId = new Map(conns.map((c) => [c.id, c]));

  for (const mon of monitors) {
    const host = mon.executionHost ?? "inherit";
    if (monitorEvaluatesOnControlPlane(host, plane)) continue;
    if (mon.type !== "s3_file_count" && mon.type !== "sqs_message_count") continue;
    if (!mon.connectionId) continue;
    const conn = byId.get(mon.connectionId);
    if (!conn) continue;

    if (mon.lastCheckAt) {
      const elapsed = (now - new Date(mon.lastCheckAt).getTime()) / 1000;
      if (elapsed < minSec) continue;
    }

    if (isolation === "spawn") {
      trySpawnMonitorCheck(mon.id);
      continue;
    }

    const cfg = asConfig(mon.config);
    const secrets =
      conn.secrets && typeof conn.secrets === "object" && !Array.isArray(conn.secrets) ? conn.secrets : {};
    const hints = connectionHints(conn.config);

    try {
      const result =
        mon.type === "s3_file_count"
          ? await evalS3FileCount(cfg, secrets, hints)
          : await evalSqsMessageCount(cfg, secrets, hints);
      await api(`/api/agent/monitors/${encodeURIComponent(mon.id)}/report`, {
        method: "POST",
        json: {
          shouldTrigger: result.shouldTrigger,
          message: result.message,
          metadata: result.metadata,
        },
      });
      console.log(
        `[eltpulse-gateway] monitor ${mon.name} (${mon.type}) reported shouldTrigger=${result.shouldTrigger}`
      );
    } catch (e) {
      console.error(`[eltpulse-gateway] monitor ${mon.name}:`, e.message || e);
    }
  }
}

function scheduleLoop() {
  let hbTimer = null;
  let runTimer = null;
  let monitorTimer = null;
  let manifestTimer = null;

  const arm = () => {
    if (hbTimer) clearInterval(hbTimer);
    if (runTimer) clearInterval(runTimer);
    if (monitorTimer) clearInterval(monitorTimer);
    if (!intervals) return;
    hbTimer = setInterval(() => {
      sendHeartbeat().catch((e) => console.error("[heartbeat]", e.message || e));
    }, intervals.heartbeat * 1000);
    runTimer = setInterval(() => {
      pollRunsOnce().catch((e) => console.error("[runs]", e.message || e));
    }, intervals.runsPoll * 1000);
    monitorTimer = setInterval(() => {
      pollMonitorsOnce().catch((e) => console.error("[monitors]", e.message || e));
    }, Math.min(intervals.sensorCheck, 120) * 1000);
  };

  manifestTimer = setInterval(() => {
    refreshManifest()
      .then(arm)
      .catch((e) => console.error("[manifest]", e.message || e));
  }, 5 * 60 * 1000);

  return refreshManifest()
    .then(arm)
    .then(() => sendHeartbeat())
    .then(() => pollRunsOnce())
    .then(() => pollMonitorsOnce());
}

if (singleRunId) {
  runSinglePipelineWorker(singleRunId)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else if (singleMonitorId) {
  runSingleMonitorWorker(singleMonitorId)
    .then(() => process.exit(0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
} else {
  scheduleLoop().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}
