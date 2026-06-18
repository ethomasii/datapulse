/**
 * Export serializable native component catalog to packages/pipeline-components/
 */
import { writeFileSync, mkdirSync, rmSync, existsSync, readdirSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { listNativeComponents } from "../web/lib/elt/native-components/registry";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgRoot = join(root, "packages/pipeline-components");
const componentsDir = join(pkgRoot, "components");

/** Preserve hand-written compile.mjs when re-exporting component.json from TS. */
const compileBackup = new Map<string, string>();
if (existsSync(componentsDir)) {
  for (const id of readdirSync(componentsDir)) {
    const compilePath = join(componentsDir, id, "compile.mjs");
    if (existsSync(compilePath)) {
      compileBackup.set(id, readFileSync(compilePath, "utf8"));
    }
  }
}

rmSync(componentsDir, { recursive: true, force: true });
mkdirSync(componentsDir, { recursive: true });

const ids: string[] = [];

for (const def of listNativeComponents()) {
  ids.push(def.id);
  const dir = join(componentsDir, def.id);
  mkdirSync(dir, { recursive: true });
  const compilePath = join(dir, "compile.mjs");
  const hasPackageCompile = compileBackup.has(def.id) || existsSync(compilePath);
  const { compile: _c, ...meta } = def;
  writeFileSync(
    join(dir, "component.json"),
    JSON.stringify(
      {
        ...meta,
        version: 1,
        runtime: "eltpulse",
        packageCompile: hasPackageCompile,
        ...(hasPackageCompile
          ? { compileArtifact: "compile.mjs" }
          : {
              compileNote:
                "Add compile.mjs alongside component.json for executable package (no datapulse PR required).",
            }),
      },
      null,
      2
    ) + "\n"
  );

  const backedUp = compileBackup.get(def.id);
  if (backedUp) {
    writeFileSync(join(dir, "compile.mjs"), backedUp);
  }
}

const manifest = {
  version: "1",
  repository: "ethomasii/eltpulse-pipeline-components",
  description: "Native executable pipeline components for eltPulse declarative v2",
  last_exported: new Date().toISOString(),
  sourceRepository: "eltpulsehq/datapulse",
  sourcePath: "web/lib/elt/native-components/definitions",
  components: ids,
};

writeFileSync(join(pkgRoot, "manifest.json"), JSON.stringify(manifest, null, 2) + "\n");
writeFileSync(
  join(root, "web/lib/elt/data/native-components-manifest.json"),
  JSON.stringify(manifest, null, 2) + "\n"
);

console.log(`Exported ${ids.length} components to ${componentsDir}`);
