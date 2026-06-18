#!/usr/bin/env node
/**
 * Bundle native pipeline component manifest (re-exports catalog from definitions).
 *
 * Usage: node scripts/sync-native-components.mjs
 * Prefer: node scripts/export-pipeline-components-catalog.mjs
 */

import { execSync } from "child_process";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
execSync("node scripts/export-pipeline-components-catalog.mjs", { cwd: root, stdio: "inherit" });
