#!/usr/bin/env node
/**
 * One command: export + publish pipeline-components catalog.
 * Usage: node scripts/manage-pipeline-components.mjs
 */
import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

function run(cmd) {
  execSync(cmd, { cwd: root, stdio: "inherit" });
}

console.log("=== pipeline-components manager ===\n");
run("node scripts/export-pipeline-components-catalog.mjs");
run("cd web && npm test -- --run native-components");
run("node scripts/publish-pipeline-components.mjs");

const manifest = JSON.parse(
  execSync("cat packages/pipeline-components/manifest.json", { cwd: root, encoding: "utf8" })
);
console.log(`\n✓ ${manifest.components.length} components · ${manifest.repository}`);
