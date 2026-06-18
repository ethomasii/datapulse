/**
 * eltPulse-native pipeline components — executable definitions migrated from
 * dagster-component-templates (schema + behavior), compiled to dlt/Sling/post-transform SQL/Python.
 */

import type { ComponentCompileTarget } from "@/lib/elt/component-compile-router";

export type NativeComponentFieldType =
  | "string"
  | "text"
  | "number"
  | "boolean"
  | "select"
  | "string_list";

export type NativeComponentField = {
  key: string;
  label: string;
  description?: string;
  type: NativeComponentFieldType;
  required?: boolean;
  default?: unknown;
  /** For select */
  options?: string[];
  placeholder?: string;
};

export type NativeComponentCompileResult = {
  /** Appended Python inside pipeline.run() after load */
  python?: string[];
  /** SQL statements run post-load */
  sql?: string[];
  /** elt_tests lines */
  tests?: string[];
  /** Quality block fragments */
  quality?: Array<{ table: string; not_null?: string[]; unique?: string[] }>;
  /** Merged into sourceConfiguration (ingestion hints, sensor metadata, dbt). */
  configPatch?: Record<string, unknown>;
  warnings?: string[];
};

export type NativeComponentDefinition = {
  id: string;
  /** Manifest ids that map to this native implementation */
  aliases?: string[];
  name: string;
  category: string;
  description: string;
  compileTarget: ComponentCompileTarget;
  fields: NativeComponentField[];
  /** Dagster-only attribute keys to hide in UI (partitions, asset metadata, etc.) */
  dagsterOnlyFields?: string[];
  compile: (config: Record<string, unknown>) => NativeComponentCompileResult;
};

export type CompiledPipelineComponents = {
  pythonBlocks: string[];
  sqlStatements: string[];
  testLines: string[];
  quality: Array<{ table: string; not_null?: string[]; unique?: string[] }>;
  warnings: string[];
  /** Whether any native compiler ran */
  compiled: boolean;
};
