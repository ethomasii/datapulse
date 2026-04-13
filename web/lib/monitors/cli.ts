import { spawn } from "child_process";

/**
 * Run the embedded_elt_builder CLI as a subprocess (argument array — no shell quoting issues).
 */
export function runEltCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve) => {
    const cwd = options?.cwd ?? process.cwd();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: cwd,
      ...options?.env,
    };
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    let settled = false;
    const finish = (stdout: string, stderr: string, code: number | null) => {
      if (settled) return;
      settled = true;
      resolve({ stdout, stderr, code });
    };
    const child = spawn("python", ["-m", "embedded_elt_builder.cli.main", ...args], {
      cwd,
      env,
      shell: false,
    });
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => errChunks.push(c));
    child.on("error", (err) => {
      const msg = err instanceof Error ? err.message : String(err);
      finish(
        Buffer.concat(chunks).toString("utf8"),
        Buffer.concat(errChunks).toString("utf8") + (errChunks.length ? "\n" : "") + msg,
        null
      );
    });
    child.on("close", (code) => {
      finish(
        Buffer.concat(chunks).toString("utf8"),
        Buffer.concat(errChunks).toString("utf8"),
        code
      );
    });
  });
}
