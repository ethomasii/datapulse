import type { ComponentCompileTarget } from "@/lib/elt/component-compile-router";
import type { NativeComponentCompileResult, NativeComponentField } from "@/lib/elt/native-components/types";

/** Parsed GitHub (or raw) catalog source. */
export type ComponentCatalogSource = {
  /** Display id, e.g. ethomasii/eltpulse-pipeline-components */
  id: string;
  /** Base URL for raw fetches, trailing slash */
  rawBase: string;
  branch: string;
};

export type ComponentPackageManifest = {
  version: string;
  repository: string;
  description?: string;
  components: string[];
  sourceRepository?: string;
  sourcePath?: string;
};

export type ComponentPackageMeta = {
  id: string;
  aliases?: string[];
  name: string;
  category: string;
  description: string;
  compileTarget: ComponentCompileTarget;
  fields: NativeComponentField[];
  dagsterOnlyFields?: string[];
  version?: number;
  runtime?: string;
  /** When true, compile.mjs in the same directory is required. */
  packageCompile?: boolean;
};

export type ComponentPackageDefinition = ComponentPackageMeta & {
  catalog: ComponentCatalogSource;
  /** Loaded compile.mjs source (cached). */
  compileSource?: string;
  compile: (config: Record<string, unknown>) => Promise<NativeComponentCompileResult>;
};

export type ComponentCatalogIndexEntry = ComponentPackageMeta & {
  catalogId: string;
  isPackage: true;
};
