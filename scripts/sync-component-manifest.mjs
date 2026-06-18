#!/usr/bin/env node
/**
 * Sync dagster-component-templates manifest into eltPulse bundled registry data.
 *
 * Usage: node scripts/sync-component-manifest.mjs [--repo owner/name]
 *
 * Writes:
 *   web/lib/elt/data/component-manifest.json
 *   web/lib/elt/data/component-manifest-index.json
 *   web/lib/elt/data/component-schema-spec.json (if present upstream)
 */

import { writeFileSync, mkdirSync } from "fs";
import { dirname, join } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const dataDir = join(root, "web/lib/elt/data");

const repo = process.argv.includes("--repo")
  ? process.argv[process.argv.indexOf("--repo") + 1]
  : "eric-thomas-dagster/dagster-component-templates";

const base = `https://raw.githubusercontent.com/${repo}/main`;

async function fetchJson(path) {
  const url = `${base}/${path}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed ${url}: ${res.status}`);
  return res.json();
}

function slimIndex(manifest) {
  return {
    version: manifest.version ?? "1",
    repository: repo,
    last_updated: new Date().toISOString().slice(0, 10),
    components: (manifest.components ?? []).map((c) => ({
      id: c.id ?? c.name,
      name: c.name ?? c.id,
      category: c.category ?? "other",
      description: c.description ?? "",
      tags: c.tags,
      path: c.path,
      icon: c.icon,
      schema_url: c.schema_url,
      example_url: c.example_url,
    })),
  };
}

async function main() {
  mkdirSync(dataDir, { recursive: true });
  console.log(`Fetching manifest from ${repo}…`);
  const manifest = await fetchJson("manifest.json");
  const index = slimIndex(manifest);

  writeFileSync(join(dataDir, "component-manifest.json"), JSON.stringify(manifest, null, 2));
  writeFileSync(join(dataDir, "component-manifest-index.json"), JSON.stringify(index, null, 2));
  console.log(`Wrote ${index.components.length} components`);

  try {
    const schemaSpec = await fetchJson("schema-spec.json");
    writeFileSync(join(dataDir, "component-schema-spec.json"), JSON.stringify(schemaSpec, null, 2));
    console.log("Wrote component-schema-spec.json");
  } catch {
    console.warn("schema-spec.json not found upstream — keeping existing file");
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
