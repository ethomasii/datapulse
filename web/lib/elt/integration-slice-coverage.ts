/**
 * Integration quality bar for eltPulse (EL+T with run slices).
 * Tier-1 connectors must either support date/key slices or honestly declare why not.
 */

import { getRunSliceCapability, runSlicesAllowed } from "./run-slice-capabilities";
import { isContextRestSource } from "./generate-dlt-context-sources";
import { isFilesystemSource } from "./generate-dlt-filesystem";
import { isIcebergSource } from "./generate-dlt-iceberg";
import { isVerifiedPackageSource, resolveVerifiedSourceSpec } from "./verified-source-spec";
import { isVendoredVerifiedSource } from "./vendored-verified-sources";

/** First-class builder / quick-start connectors — Fivetran-competitive bar. */
export const TIER1_PIPELINE_SOURCES = [
  "github",
  "stripe",
  "shopify",
  "hubspot",
  "salesforce",
  "pipedrive",
  "postgres",
  "mysql",
  "slack",
  "notion",
  "airtable",
  "zendesk",
  "freshdesk",
  "jira",
  "google_analytics",
  "matomo",
  "facebook_ads",
  "google_ads",
  "intercom",
  "mixpanel",
  "asana",
  "workable",
  "personio",
  "strapi",
  "s3",
  "gcs",
  "iceberg",
  "rest_api",
] as const;

/** Legitimate full-replace or catalog-only sources (run slices N/A). */
export const TIER1_NONE_ONLY_OK = new Set([
  "segment",
  "google_sheets",
  "bing_webmaster",
  "inbox",
  "mux",
  "google_ads",
]);

export type IntegrationSliceAudit = {
  slug: string;
  slicesAllowed: boolean;
  vendored: boolean;
  hasDedicatedCodegen: boolean;
  issue?: string;
};

function hasDedicatedCodegen(slug: string): boolean {
  return (
    slug === "github" ||
    slug === "stripe" ||
    slug === "stripe_analytics" ||
    slug === "postgres" ||
    slug === "postgresql" ||
    isContextRestSource(slug) ||
    isFilesystemSource(slug) ||
    isIcebergSource(slug)
  );
}

export function auditIntegrationSliceCoverage(
  slugs: readonly string[] = TIER1_PIPELINE_SOURCES
): IntegrationSliceAudit[] {
  return slugs.map((slug) => {
    const cap = getRunSliceCapability(slug);
    const slicesAllowed = runSlicesAllowed(slug);
    const vendored = isVendoredVerifiedSource(slug);
    const dedicated = hasDedicatedCodegen(slug);
    const verified = isVerifiedPackageSource(slug);

    let issue: string | undefined;
    if (TIER1_NONE_ONLY_OK.has(slug)) {
      if (slicesAllowed) issue = "expected none_only but slices are allowed";
    } else if (!slicesAllowed && !TIER1_NONE_ONLY_OK.has(slug)) {
      issue = cap.detail;
    } else if (verified && !vendored && !dedicated) {
      issue = "verified spec exists but source is not vendored on managed worker";
    }

    return { slug, slicesAllowed, vendored, hasDedicatedCodegen: dedicated || verified, issue };
  });
}

export function tier1IntegrationGaps(): IntegrationSliceAudit[] {
  return auditIntegrationSliceCoverage().filter((row) => row.issue);
}

export function tier1SliceCoveragePercent(): number {
  const rows = auditIntegrationSliceCoverage();
  const ok = rows.filter((r) => r.slicesAllowed || TIER1_NONE_ONLY_OK.has(r.slug)).length;
  return Math.round((ok / rows.length) * 100);
}

/** Summarize spec wiring for diagnostics. */
export function describeSourceSliceWiring(slug: string): string {
  const spec = resolveVerifiedSourceSpec(slug);
  if (!spec) return "no verified spec (golden/context/storage path)";
  if (spec.partitionSliceMode) return `mode=${spec.partitionSliceMode}`;
  if (spec.partitionKwarg) {
    return spec.partitionEndKwarg
      ? `${spec.partitionKwarg}..${spec.partitionEndKwarg}`
      : spec.partitionKwarg;
  }
  return "no partition wiring";
}
