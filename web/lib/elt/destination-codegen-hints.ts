/**
 * Normalize destination slugs for dlt/Sling codegen (Iceberg → S3 + table_format hints).
 */

export type CodegenDestinationResolution = {
  destinationType: string;
  hints: Record<string, unknown>;
};

export function resolveDestinationForCodegen(
  destinationType: string,
  sourceConfiguration: Record<string, unknown>
): CodegenDestinationResolution {
  const slug = destinationType.toLowerCase().trim();

  if (slug === "iceberg") {
    const warehouse =
      typeof sourceConfiguration.warehouse === "string"
        ? sourceConfiguration.warehouse
        : typeof sourceConfiguration.bucket === "string"
          ? sourceConfiguration.bucket
          : "";
    return {
      destinationType: "s3",
      hints: {
        table_format: "iceberg",
        destination_display_type: "iceberg",
        ...(warehouse ? { warehouse_uri: warehouse } : {}),
        layout: "iceberg",
      },
    };
  }

  return { destinationType: slug, hints: {} };
}

export function applyDestinationCodegenHints(
  destinationType: string,
  config: Record<string, unknown>
): { destinationType: string; config: Record<string, unknown> } {
  const resolved = resolveDestinationForCodegen(destinationType, config);
  if (!Object.keys(resolved.hints).length) {
    return { destinationType, config };
  }
  return {
    destinationType: resolved.destinationType,
    config: { ...config, ...resolved.hints },
  };
}
