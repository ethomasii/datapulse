#!/usr/bin/env node
/**
 * Bundle native pipeline component manifest for CI/docs.
 * Full compilers live in web/lib/elt/native-components/definitions/.
 *
 * Usage: node scripts/sync-native-components.mjs
 */

import { readFileSync, writeFileSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgManifest = join(root, "packages/pipeline-components/manifest.json");
const out = join(root, "web/lib/elt/data/native-components-manifest.json");

const manifest = JSON.parse(readFileSync(pkgManifest, "utf8"));
manifest.last_synced = new Date().toISOString();
writeFileSync(out, JSON.stringify(manifest, null, 2));
console.log(`Wrote ${out} (${manifest.components.length} native components)`);
