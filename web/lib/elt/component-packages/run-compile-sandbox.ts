import vm from "node:vm";
import type { NativeComponentCompileResult } from "@/lib/elt/native-components/types";

const COMPILE_TIMEOUT_MS = 8000;

function normalizeCompileSource(source: string): string {
  let body = source.trim();
  body = body.replace(/export\s+default\s+function\s+compile\b/, "function compile");
  body = body.replace(/export\s+function\s+compile\b/, "function compile");
  body = body.replace(/export\s*\{[^}]*\}\s*;?/g, "");
  return `${body}
if (typeof compile === "function") {
  module.exports = { compile };
}
`;
}

/**
 * Run untrusted compile.mjs in a limited VM (no require, no fetch).
 * Module must export `compile(config)` returning NativeComponentCompileResult.
 */
export function runCompileInSandbox(
  compileSource: string,
  config: Record<string, unknown>
): NativeComponentCompileResult {
  const moduleObj = { exports: {} as Record<string, unknown> };
  const sandbox: Record<string, unknown> = {
    module: moduleObj,
    exports: moduleObj.exports,
    console: { log: () => undefined, warn: () => undefined, error: () => undefined },
  };

  const script = normalizeCompileSource(compileSource);

  vm.runInNewContext(script, sandbox, {
    timeout: COMPILE_TIMEOUT_MS,
    filename: "component-package-compile.mjs",
  });

  const compileFn = moduleObj.exports.compile;
  if (typeof compileFn !== "function") {
    throw new Error("compile.mjs must export function compile(config)");
  }

  const result = compileFn(config);
  if (!result || typeof result !== "object") {
    throw new Error("compile(config) must return an object");
  }
  return result as NativeComponentCompileResult;
}
