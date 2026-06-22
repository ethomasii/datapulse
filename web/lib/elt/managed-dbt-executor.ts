/**
 * Standalone dbt execution for eltPulse managed workers (Node local executor).
 */
import { spawn, type ChildProcessWithoutNullStreams } from "node:child_process";
import * as fs from "node:fs/promises";
import * as os from "node:os";
import * as path from "node:path";
import { sanitizeForRunStorage } from "@/lib/elt/run-log-sanitize";
import {
  buildDbtProfilesYml,
  dbtActionFromTriggeredBy,
  dbtSelectArgs,
} from "@/lib/elt/dbt-profiles-yml";
import type { PatchRunBody } from "@/lib/elt/run-types";

export type ManagedDbtContext = {
  runId: string;
  baseUrl: string;
  secret: string;
  triggeredBy: string | null;
  pipeline: {
    name: string;
    sourceConfiguration: unknown;
  };
  dbtProject: {
    gitUrl: string | null;
    gitBranch: string | null;
    gitSubpath: string | null;
    packagePath: string;
    targetSchema: string | null;
  } | null;
  destination: {
    connector: string;
    secrets: Record<string, string>;
  } | null;
  patch: (body: PatchRunBody) => Promise<void>;
  appendLog: (stream: "stdout" | "stderr", line: string) => Promise<void>;
};

async function gitClone(gitUrl: string, branch: string, dest: string): Promise<void> {
  const { execFile } = await import("node:child_process");
  const { promisify } = await import("node:util");
  const exec = promisify(execFile);
  const br = branch.trim() || "main";
  try {
    await exec("git", ["clone", "--depth", "1", "--branch", br, gitUrl, dest], {
      timeout: 120_000,
    });
  } catch {
    await fs.rm(dest, { recursive: true, force: true }).catch(() => undefined);
    await exec("git", ["clone", "--depth", "1", gitUrl, dest], { timeout: 120_000 });
  }
}

async function runDbtCmd(
  cwd: string,
  args: string[],
  env: NodeJS.ProcessEnv,
  appendLog: ManagedDbtContext["appendLog"],
  timeoutMs: number
): Promise<number> {
  const dbtBin = process.env.ELTPULSE_DBT_BIN?.trim() || "dbt";
  return new Promise((resolve, reject) => {
    const child = spawn(dbtBin, args, {
      cwd,
      env,
      windowsHide: true,
      shell: false,
    }) as ChildProcessWithoutNullStreams;

    const timer = setTimeout(() => child.kill("SIGTERM"), timeoutMs);

    const pump = (stream: NodeJS.ReadableStream | null, label: "stdout" | "stderr") => {
      if (!stream) return Promise.resolve();
      return new Promise<void>((res) => {
        let buf = "";
        stream.on("data", (d: Buffer | string) => {
          buf += typeof d === "string" ? d : d.toString("utf8");
          const lines = buf.split(/\r?\n/);
          buf = lines.pop() ?? "";
          for (const line of lines) {
            if (line.trim()) void appendLog(label, line);
          }
        });
        stream.on("end", () => {
          if (buf.trim()) void appendLog(label, buf.trim());
          res();
        });
      });
    };

    Promise.all([pump(child.stdout, "stdout"), pump(child.stderr, "stderr")]).catch(() => undefined);

    child.on("error", (e) => {
      clearTimeout(timer);
      reject(e);
    });
    child.on("close", (code) => {
      clearTimeout(timer);
      resolve(code === null || code === undefined ? 1 : code);
    });
  });
}

async function uploadDbtArtifacts(projectDir: string, ctx: ManagedDbtContext): Promise<void> {
  const target = path.join(projectDir, "target");
  const body: PatchRunBody = {};
  try {
    const runResults = path.join(target, "run_results.json");
    const manifest = path.join(target, "manifest.json");
    if (await fs.stat(runResults).then(() => true).catch(() => false)) {
      body.dbtRunResults = JSON.parse(await fs.readFile(runResults, "utf8"));
    }
    if (await fs.stat(manifest).then(() => true).catch(() => false)) {
      body.dbtArtifactManifest = JSON.parse(await fs.readFile(manifest, "utf8"));
    }
    if (Object.keys(body).length > 0) {
      await ctx.patch(body);
    }
  } catch {
    /* artifact upload is best-effort */
  }
}

export async function executeManagedDbtRun(ctx: ManagedDbtContext, timeoutMs: number): Promise<number> {
  const proj = ctx.dbtProject;
  const gitUrl = proj?.gitUrl?.trim() ?? "";
  if (!gitUrl) {
    throw new Error("dbt project has no Git URL — configure gitUrl on the project for managed runs");
  }

  const workRoot = await fs.mkdtemp(path.join(os.tmpdir(), "eltpulse-dbt-"));
  try {
    const repoDir = path.join(workRoot, "repo");
    await gitClone(gitUrl, proj?.gitBranch ?? "main", repoDir);
    const sub = proj?.gitSubpath?.trim();
    const projectDir = sub ? path.join(repoDir, sub) : repoDir;

    const profileName = ctx.pipeline.name.replace(/[^a-zA-Z0-9_-]/g, "_") || "eltpulse";
    const connector = ctx.destination?.connector ?? "snowflake";
    const profiles = buildDbtProfilesYml({
      profileName,
      connector,
      targetSchema: proj?.targetSchema,
      config: {},
    });
    if (!profiles) {
      throw new Error(`Unsupported dbt destination connector: ${connector}`);
    }
    await fs.writeFile(path.join(projectDir, "profiles.yml"), profiles, "utf8");

    const childEnv: NodeJS.ProcessEnv = {
      ...process.env,
      ...(ctx.destination?.secrets ?? {}),
      DBT_PROFILES_DIR: projectDir,
      ELTPULSE_RUN_ID: ctx.runId,
      ELTPULSE_CONTROL_PLANE_URL: ctx.baseUrl,
      ELTPULSE_INTERNAL_API_SECRET: ctx.secret,
    };

    const common = ["--profiles-dir", projectDir, "--profile", profileName, "--target", "dev"];
    const action = dbtActionFromTriggeredBy(ctx.triggeredBy);
    const selectArgs = dbtSelectArgs(ctx.pipeline.sourceConfiguration);

    await ctx.patch({
      status: "running",
      appendLog: {
        level: "info",
        message: sanitizeForRunStorage(`dbt: prepared project at ${projectDir}`, 4000),
      },
      telemetrySummary: { currentPhase: "dbt", progress: 20 },
    });

    const depsCode = await runDbtCmd(
      projectDir,
      [...common, "deps"],
      childEnv,
      ctx.appendLog,
      timeoutMs
    );
    if (depsCode !== 0) return depsCode;

    const actionArgs =
      action === "compile" ? ["compile"] : action === "test" ? ["test"] : ["run"];

    await ctx.patch({ telemetrySummary: { currentPhase: "dbt", progress: 50 } });
    const exitCode = await runDbtCmd(
      projectDir,
      [...common, ...actionArgs, ...selectArgs],
      childEnv,
      ctx.appendLog,
      timeoutMs
    );

    if (exitCode === 0) {
      await uploadDbtArtifacts(projectDir, ctx);
      await ctx.patch({ telemetrySummary: { currentPhase: "done", progress: 100 } });
    }
    return exitCode;
  } finally {
    await fs.rm(workRoot, { recursive: true, force: true }).catch(() => undefined);
  }
}
