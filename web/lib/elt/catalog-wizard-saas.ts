import type { DltHubSource } from "@/lib/elt/dlt-hub-registry";
import { hasDiscoverCatalog } from "@/lib/elt/source-discover";
import { isDatabaseCatalogSource } from "@/lib/elt/catalog-wizard-database";

/** Discover API connector slug for a catalog source (may differ from pipeline sourceType). */
export function saasDiscoverConnector(source: Pick<DltHubSource, "slug">): string {
  const slug = source.slug.toLowerCase();
  if (slug === "shopify_dlt") return "shopify";
  if (hasDiscoverCatalog(slug)) return slug;
  if (slug === "stripe") return "stripe";
  return slug;
}

/** Connection picker slugs that match saved OAuth/API connections. */
export function saasSourceConnectors(source: Pick<DltHubSource, "slug">): string[] {
  const slug = source.slug.toLowerCase();
  if (slug === "stripe_analytics" || slug === "stripe") return ["stripe", "stripe_analytics"];
  if (slug === "shopify_dlt") return ["shopify", "shopify_dlt"];
  return [saasDiscoverConnector(source)];
}

/** Pipeline `sourceType` when saving from the catalog wizard. */
export function pipelineSourceTypeFromCatalogSlug(slug: string): string {
  const s = slug.toLowerCase();
  if (s === "stripe" || s === "stripe_analytics") return "stripe_analytics";
  if (s === "shopify_dlt") return "shopify_dlt";
  return s;
}

/** SaaS sources with a static resource catalog (quick-start style picker). */
export function isSaasDiscoverSource(source: Pick<DltHubSource, "slug" | "category">): boolean {
  if (isDatabaseCatalogSource(source)) return false;
  return hasDiscoverCatalog(saasDiscoverConnector(source));
}
