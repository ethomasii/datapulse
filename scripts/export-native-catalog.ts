/**
 * Export serializable native component catalog to packages/pipeline-components/
 */
import { writeFileSync, mkdirSync, rmSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { listNativeComponents } from "../web/lib/elt/native-components/registry";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const pkgRoot = join(root, "packages/pipeline-components");
const componentsDir = join(pkgRoot, "components");

rmSync(componentsDir, { recursive: true, force: true });
mkdirSync(componentsDir, { recursive: true });

const ids: string[] = [];

for (const def of listNativeComponents()) {
  ids.push(def.id);
  const dir = join(componentsDir, def.id);
  mkdirSync(dir, { recursive: true });
  const { compile: _c, ...meta } = def;
  writeFileSync(
    join(dir, "component.json"),
    JSON.stringify(
      {
        ...meta,
        version: 1,
        runtime: "eltpulse",
        compileNote: "Executable compile() lives in datapulse web/lib/elt/native-components/definitions/",
      },
      null,
      2
    ) + "\n"
  );
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
