import { spawn } from "child_process";

/**
 * Run the embedded_elt_builder CLI as a subprocess (argument array — no shell quoting issues).
 */
export function runEltCli(
  args: string[],
  options?: { cwd?: string; env?: Record<string, string> }
): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const cwd = options?.cwd ?? process.cwd();
    const env: NodeJS.ProcessEnv = {
      ...process.env,
      PYTHONPATH: cwd,
      ...options?.env,
    };
    const chunks: Buffer[] = [];
    const errChunks: Buffer[] = [];
    const child = spawn("python", ["-m", "embedded_elt_builder.cli.main", ...args], {
      cwd,
      env,
      shell: false,
    });
    child.stdout.on("data", (c) => chunks.push(c));
    child.stderr.on("data", (c) => errChunks.push(c));
    child.on("error", reject);
    child.on("close", (code) => {
      resolve({
        stdout: Buffer.concat(chunks).toString("utf8"),
        stderr: Buffer.concat(errChunks).toString("utf8"),
        code,
      });
    });
  });
}
