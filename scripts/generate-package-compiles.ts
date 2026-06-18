/**
 * Bundle each native component compile() into standalone compile.mjs for the catalog package.
 * Run from repo root: cd web && npx tsx ../scripts/generate-package-compiles.ts
 */
import { execSync } from "child_process";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "fs";
import { tmpdir } from "os";
import { dirname, join } from "path";
import { fileURLToPath } from "url";
import { PACKAGE_COMPILE_ENTRIES } from "./package-compile-entries/manifest";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const nativeRoot = join(root, "web/lib/elt/native-components");
const outRoot = join(root, "packages/pipeline-components/components");
const tmpDir = mkdtempSync(join(tmpdir(), "eltpulse-compile-"));

mkdirSync(outRoot, { recursive: true });

for (const { id, module, export: exportName } of PACKAGE_COMPILE_ENTRIES) {
  const entryPath = join(tmpDir, `${id}.ts`);
  writeFileSync(
    entryPath,
    `import { ${exportName} as _def } from "${join(nativeRoot, module).replace(/\\/g, "/")}";
export function compile(config: Record<string, unknown>) {
  return _def.compile(config);
}
`
  );

  const outDir = join(outRoot, id);
  mkdirSync(outDir, { recursive: true });
  const outfile = join(outDir, "compile.mjs");
  const cmd = [
    "npx esbuild",
    `"${entryPath}"`,
    "--bundle",
    "--format=esm",
    "--platform=node",
    `--outfile="${outfile}"`,
    "--log-level=warning",
  ].join(" ");

  execSync(cmd, { cwd: root, stdio: "pipe" });
  console.log(`  ✓ ${id}/compile.mjs`);
}

rmSync(tmpDir, { recursive: true, force: true });
console.log(`Generated ${PACKAGE_COMPILE_ENTRIES.length} package compilers → ${outRoot}`);
