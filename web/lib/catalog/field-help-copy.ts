/** Shared field help copy for catalog governance forms. */

export const CATALOG_FIELD_HELP = {
  productName:
    "The human-readable title shown in the Library and on product cards — e.g. “Monthly revenue mart”.",
  productSlug:
    "A short, stable ID used in links and the API (often called a “slug”). Example: monthly-revenue. Auto-filled from the name using lowercase letters, numbers, and hyphens. Cannot be changed after you save.",
  productDescription:
    "What this product contains and who it is for. Shown to consumers browsing the catalog.",
  productOwner: "The team or person accountable for quality, updates, and questions about this product.",
  productDomain:
    "The business area this data belongs to — e.g. finance, marketing, or product analytics. Helps consumers filter and discover products.",
  productConsumerTags:
    "Who should use this product: analytics, finance, ML, etc. Comma-separated tags for search and discovery.",
  productContract:
    "Optional link to a data contract that defines required columns and freshness SLAs for assets in this product.",
  productFeatured:
    "When checked, this product is highlighted on the Library hub so new consumers see it first.",
  productAssets:
    "Catalog assets (tables, models, etc.) bundled into this product. Consumers get one entry point to all related datasets.",

  contractName: "A clear name for this contract — e.g. “Orders raw table contract”.",
  contractSlug:
    "Stable ID for this contract in URLs and alerts (a “slug”), like orders-raw. Auto-filled from the name; cannot be changed after save.",
  contractDescription: "What consumers can rely on: scope, breaking-change policy, and context.",
  contractOwner: "Team or person responsible for maintaining this contract.",
  contractOwnerEmail: "Contact for contract questions or violation alerts.",
  contractStatus:
    "Draft = not enforced yet. Active = compliance checks run after pipeline runs. Deprecated = kept for history but not promoted to consumers.",
  contractFreshnessSla:
    "Maximum age of data in hours since the last successful pipeline run. Example: 24 means data must be refreshed at least daily.",
  contractSchema:
    "Columns consumers can expect. Import from linked assets to copy the current warehouse or dbt schema instead of typing manually.",
  contractLinkedAssets:
    "Catalog assets governed by this contract. Compliance (missing columns, stale data) is checked on their detail pages and after runs.",

  assetCertify:
    "Marks this asset as reviewed and trusted for consumers. Also creates or updates an active data contract from the asset’s current column schema.",
} as const;
