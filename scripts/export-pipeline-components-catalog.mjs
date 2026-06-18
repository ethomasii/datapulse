/**
 * Export native component metadata to packages/pipeline-components/components
 * Run from repo root: node scripts/export-pipeline-components-catalog.mjs
 * Requires tsx in web/ (invoked by this script)
 */

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("npx tsx ../scripts/export-native-catalog.ts", {
  cwd: join(root, "web"),
  stdio: "inherit",
});
