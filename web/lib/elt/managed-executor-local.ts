/**
 * eltPulse-managed local subprocess executor: runs dlt (`python pipeline.py [partition]`)
 * or Sling (`sling run -r replication.yaml`) in a temp directory, with connection secrets
 * injected as environment variables (same pattern as the self-hosted agent).
 *
 * Used when `ELTPULSE_MANAGED_EXECUTOR=local` (see `runManagedWorkerBatchHttp`).
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { sanitizeForRunStorage } from "@/lib/elt/run-log-sanitize";
import {
  fetchPendingManagedRunIds,
  managedInternalGet,
  managedInternalPatch,
} from "@/lib/elt/managed-worker-stub-http";
import type { PatchRunBody } from "@/lib/elt/run-types";

type ExecutorContextJson = {
  run: {
    id: string;
    status: string;
    partitionValue: string | null;
    partitionColumn: string | null;
    correlationId: string;
  };
  pipeline: {
    id: string;
    name: string;
    tool: string;
    sourceType: string;
    destinationType: string;
    sourceConfiguration: unknown;
    pipelineCode: string;
    configYaml: string | null;
    workspaceYaml: string | null;
    sourceConnectionId: string | null;
    destinationConnectionId: string | null;
  };
  connections: {
    source: null | { secrets: Record<string, string> };
    destination: null | { secrets: Record<string, string> };
  };
};

const DEFAULT_TIMEOUT_MS = 45 * 60 * 1000;
const LOG_CHUNK = 3400;

async function throwIfNotOk(res: Response, label: string): Promise<void> {
  if (res.ok) return;
  const t = await res.text();
  throw new Error(`${label} ${res.status}: ${t.slice(0, 800)}`);
}

async function patchOrThrow(baseUrl: string, secret: string, runId: string, body: PatchRunBody) {
  const res = await managedInternalPatch(baseUrl, secret, runId, body);
  await throwIfNotOk(res, `PATCH managed ${runId}`);
}

async function appendLogLine(
  baseUrl: string,
  secret: string,
  runId: string,
  stream: "stdout" | "stderr",
  line: string
) {
  const message = sanitizeForRunStorage(`[${stream}] ${line}`, 4000);
  await patchOrThrow(baseUrl, secret, runId, {
    status: "running",
    appendLog: { level: stream === "stderr" ? "warn" : "info", message },
  });
}

function mergeEnv(
  base: NodeJS.ProcessEnv,
  a: Record<string, string> | null | undefined,
  b: Record<string, string> | null | undefined
): NodeJS.ProcessEnv {
  const out: NodeJS.ProcessEnv = { ...base };
  if (a) for (const [k, v] of Object.entries(a)) if (v) out[k] = v;
  if (b) for (const [k, v] of Object.entries(b)) if (v) out[k] = v;
  return out;
}

function defaultPythonBin(): string {
  return process.platform === "win32" ? "python" : "python3";
}

async function writeWorkspace(dir: string, pipeline: ExecutorContextJson["pipeline"]): Promise<void> {
  const tool = pipeline.tool === "sling" ? "sling" : "dlt";
  if (tool === "sling") {
    await fs.writeFile(path.join(dir, "replication.yaml"), pipeline.pipelineCode, "utf8");
  } else {
    await fs.writeFile(path.join(dir, "pipeline.py"), pipeline.pipelineCode, "utf8");
  }
  if (pipeline.configYaml?.trim()) {
    await fs.writeFile(path.join(dir, "config.yaml"), pipeline.configYaml, "utf8");
  }
  if (pipeline.workspaceYaml?.trim()) {
    await fs.writeFile(path.join(dir, "workspace.yaml"), pipeline.workspaceYaml, "utf8");
  }
}

async function pumpStream(
  stream: NodeJS.ReadableStream | null,
  label: "stdout" | "stderr",
  baseUrl: string,
  secret: string,
  runId: string
) {
  if (!stream) return;
  let buf = "";
  const flushLines = async (force: boolean) => {
    if (!buf) return;
    if (!force && buf.length < LOG_CHUNK) return;
    const chunk = buf.slice(0, LOG_CHUNK);
    buf = buf.slice(chunk.length);
    const lines = chunk.split(/\r?\n/);
    const complete = lines.slice(0, -1);
    const tail = lines[lines.length - 1] ?? "";
    for (const line of complete) {
      if (line.trim()) await appendLogLine(baseUrl, secret, runId, label, line);
    }
    buf = tail + buf;
  };

  const iterable = stream as NodeJS.ReadableStream & AsyncIterable<Buffer | string>;
  try {
    for await (const d of iterable) {
      buf += typeof d === "string" ? d : d.toString("utf8");
      await flushLines(false);
    }
  } catch {
    /* stream may already be destroyed */
  }
  await flushLines(true);
  if (buf.trim()) await appendLogLine(baseUrl, secret, runId, label, buf.trim());
}

function spawnPipelineChild(
  dir: string,
  tool: "dlt" | "sling",
  partitionValue: string | null | undefined,
  childEnv: NodeJS.ProcessEnv,
  timeoutMs: number
): ChildProcessWithoutNullStreams {
  const pythonBin = process.env.ELTPULSE_MANAGED_PYTHON_BIN?.trim() || defaultPythonBin();
  const slingBin = process.env.ELTPULSE_MANAGED_SLING_BIN?.trim() || "sling";

  let child: ChildProcessWithoutNullStreams;
  if (tool === "sling") {
    child = spawn(slingBin, ["run", "-r", "replication.yaml"], {
      cwd: dir,
      env: childEnv,
      windowsHide: true,
      shell: false,
    }) as ChildProcessWithoutNullStreams;
  } else {
    const args = ["pipeline.py"];
    const pv = partitionValue?.trim();
    if (pv) args.push(pv);
    child = spawn(pythonBin, args, {
      cwd: dir,
      env: childEnv,
      windowsHide: true,
      shell: false,
    }) as ChildProcessWithoutNullStreams;
  }

  const t = setTimeout(() => {
    child.kill("SIGTERM");
  }, timeoutMs);
  child.once("close", () => clearTimeout(t));

  return child;
}

/**
 * Claims the run, loads secrets, executes tool in a temp dir, PATCHes real logs + terminal status.
 * @returns `skipped` when another worker won the claim (409).
 */
export async function executeManagedRunLocalProcess(options: {
  baseUrl: string;
  secret: string;
  runId: string;
}): Promise<"ran" | "skipped"> {
  const { baseUrl, secret, runId } = options;

  const claimRes = await managedInternalPatch(baseUrl, secret, runId, { status: "running" });
  if (claimRes.status === 409) {
    return "skipped";
  }
  await throwIfNotOk(claimRes, `claim managed ${runId}`);

  const ctxRes = await managedInternalGet(
    baseUrl,
    secret,
    `/api/internal/managed-runs/${encodeURIComponent(runId)}/executor-context`
  );
  await throwIfNotOk(ctxRes, `GET executor-context ${runId}`);
  const ctx = (await ctxRes.json()) as ExecutorContextJson;

  const tool = ctx.pipeline.tool === "sling" ? "sling" : "dlt";
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "eltpulse-managed-"));

  try {
    await patchOrThrow(baseUrl, secret, runId, {
      status: "running",
      appendLog: {
        level: "info",
        message: sanitizeForRunStorage(
          `eltpulse-managed: starting local ${tool} in ${dir} (pipeline "${ctx.pipeline.name}")`,
          4000
        ),
      },
    });

    await writeWorkspace(dir, ctx.pipeline);

    const childEnv = mergeEnv(
      process.env,
      ctx.connections.source?.secrets,
      ctx.connections.destination?.secrets
    );

    const timeoutMs = Math.max(
      60_000,
      Number(process.env.ELTPULSE_MANAGED_RUN_TIMEOUT_MS || "") || DEFAULT_TIMEOUT_MS
    );

    let exitCode: number | null = 1;
    try {
      const child = spawnPipelineChild(dir, tool, ctx.run.partitionValue, childEnv, timeoutMs);
      let settledCode = 1;
      await Promise.all([
        pumpStream(child.stdout, "stdout", baseUrl, secret, runId),
        pumpStream(child.stderr, "stderr", baseUrl, secret, runId),
        new Promise<void>((resolve, reject) => {
          child.once("error", reject);
          child.once("close", (code) => {
            settledCode = code === null || code === undefined ? 1 : code;
            resolve();
          });
        }),
      ]);
      exitCode = settledCode;
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      await patchOrThrow(baseUrl, secret, runId, {
        status: "failed",
        errorSummary: sanitizeForRunStorage(msg, 8000),
        appendLog: { level: "error", message: sanitizeForRunStorage(msg, 4000) },
        telemetrySummary: { currentPhase: "failed", progress: 100 },
      });
      return "ran";
    }

    if (exitCode === 0) {
      await patchOrThrow(baseUrl, secret, runId, {
        status: "succeeded",
        appendLog: {
          level: "info",
          message: sanitizeForRunStorage(`eltpulse-managed: ${tool} completed (exit 0).`, 4000),
        },
        telemetrySummary: { currentPhase: "done", progress: 100 },
      });
    } else {
      await patchOrThrow(baseUrl, secret, runId, {
        status: "failed",
        errorSummary: sanitizeForRunStorage(`Process exited with code ${exitCode}`, 8000),
        appendLog: {
          level: "error",
          message: sanitizeForRunStorage(
            `eltpulse-managed: ${tool} exited with code ${exitCode}`,
            4000
          ),
        },
        telemetrySummary: { currentPhase: "failed", progress: 100 },
      });
    }
    return "ran";
  } finally {
    await fs.rm(dir, { recursive: true, force: true }).catch(() => {});
  }
}

export async function runManagedWorkerLocalBatchHttp(options: {
  baseUrl: string;
  secret: string;
  limit: number;
  deadlineMs: number;
}): Promise<{ processed: number; errors: string[] }> {
  const errors: string[] = [];
  const deadline = Date.now() + options.deadlineMs;
  const ids = await fetchPendingManagedRunIds(options.baseUrl, options.secret, options.limit);
  let processed = 0;
  for (const id of ids) {
    if (Date.now() > deadline) break;
    try {
      const outcome = await executeManagedRunLocalProcess({
        baseUrl: options.baseUrl,
        secret: options.secret,
        runId: id,
      });
      if (outcome === "ran") processed += 1;
    } catch (e) {
      errors.push(`${id}: ${e instanceof Error ? e.message : String(e)}`);
      try {
        await patchOrThrow(options.baseUrl, options.secret, id, {
          status: "failed",
          errorSummary: sanitizeForRunStorage(e instanceof Error ? e.message : String(e), 8000),
        });
      } catch {
        /* ignore secondary failure */
      }
    }
  }
  return { processed, errors };
}
