import { getNativeComponent } from "@/lib/elt/native-components/registry";
import type { NativeComponentCompileResult } from "@/lib/elt/native-components/types";
import { resolvePackageComponent } from "./registry";

export type ResolvedComponentCompiler = {
  id: string;
  source: "package" | "builtin";
  catalogId?: string;
  compile: (config: Record<string, unknown>) => Promise<NativeComponentCompileResult>;
};

/**
 * Resolve executable compiler: remote package (compile.mjs) first, then built-in TS native.
 */
export async function resolveComponentCompiler(
  componentId: string,
  options?: {
    sourceConfiguration?: Record<string, unknown> | null;
    workspaceCatalogUrls?: string[] | null;
    /** When true, skip remote package lookup (tests). */
    builtinOnly?: boolean;
  }
): Promise<ResolvedComponentCompiler | null> {
  const id = componentId.trim();
  if (!id) return null;

  if (!options?.builtinOnly) {
    const pkg = await resolvePackageComponent(
      id,
      options?.sourceConfiguration,
      options?.workspaceCatalogUrls
    );
    if (pkg) {
      return {
        id: pkg.id,
        source: "package",
        catalogId: pkg.catalog.id,
        compile: pkg.compile,
      };
    }
  }

  const builtin = getNativeComponent(id);
  if (builtin) {
    return {
      id: builtin.id,
      source: "builtin",
      compile: async (config) => builtin.compile(config),
    };
  }

  return null;
}

export async function hasComponentCompiler(
  componentId: string,
  options?: Parameters<typeof resolveComponentCompiler>[1]
): Promise<boolean> {
  return (await resolveComponentCompiler(componentId, options)) !== null;
}
