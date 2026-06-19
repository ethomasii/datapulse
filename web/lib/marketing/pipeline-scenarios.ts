/** Curated pipeline recipes for marketing — links real catalog slugs. */

import { canvasStarterHref } from "@/lib/elt/lake-defaults";

export type ScenarioIndustry =
  | "saas"
  | "ecommerce"
  | "enterprise"
  | "marketing"
  | "engineering"
  | "support"
  | "data-platform";

export const SCENARIO_INDUSTRY_LABELS: Record<ScenarioIndustry, string> = {
  saas: "SaaS",
  ecommerce: "E-commerce",
  enterprise: "Enterprise",
  marketing: "Marketing",
  engineering: "Engineering",
  support: "Customer support",
  "data-platform": "Data platform",
};

export type PipelineScenario = {
  id: string;
  title: string;
  description: string;
  sourceSlug: string;
  destinationSlug: string;
  persona: string;
  industry: ScenarioIndustry;
  benefits: string[];
  tags: string[];
  /** Lake recipe to open on canvas after deploy (default: quick mart). */
  lakeStarterId?: string;
};

export const PIPELINE_SCENARIOS: PipelineScenario[] = [
  {
    id: "stripe-snowflake",
    title: "Stripe revenue analytics in Snowflake",
    description:
      "Sync customers, subscriptions, invoices, and charges into Snowflake for finance dashboards and cohort analysis — without maintaining custom Stripe ETL scripts.",
    sourceSlug: "stripe_analytics",
    destinationSlug: "snowflake",
    persona: "Finance & RevOps",
    industry: "saas",
    benefits: ["Incremental by event date", "dbt-ready tables", "No Fivetran MAR lock-in"],
    tags: ["billing", "saas", "warehouse"],
  },
  {
    id: "github-bigquery",
    title: "Engineering metrics from GitHub",
    description:
      "Load issues, PRs, reviews, and stargazers into BigQuery for DORA metrics, sprint reporting, and open-source community analytics.",
    sourceSlug: "github",
    destinationSlug: "bigquery",
    persona: "Platform & DevEx teams",
    industry: "engineering",
    benefits: ["Partition by day", "Verified connector", "Export to Git for review"],
    tags: ["developer", "analytics"],
  },
  {
    id: "postgres-snowflake",
    title: "Postgres OLTP → Snowflake warehouse",
    description:
      "Replicate production Postgres tables to Snowflake — the classic operational-to-analytical handoff for BI and embedded analytics.",
    sourceSlug: "postgres",
    destinationSlug: "snowflake",
    persona: "Data engineers",
    industry: "data-platform",
    benefits: ["Database replication", "Table-level streams", "Incremental cursors"],
    tags: ["database", "replication"],
  },
  {
    id: "hubspot-duckdb",
    title: "HubSpot CRM in DuckDB for startups",
    description:
      "Pull contacts, deals, and engagements into DuckDB for fast local analytics, prototyping, and lightweight reverse-ETL experiments.",
    sourceSlug: "hubspot",
    destinationSlug: "duckdb",
    persona: "Growth & ops",
    industry: "saas",
    benefits: ["Low-cost destination", "Great for local dev", "Verified HubSpot source"],
    tags: ["crm", "startup"],
  },
  {
    id: "salesforce-snowflake",
    title: "Salesforce pipeline reporting",
    description:
      "Land accounts, opportunities, and activities in Snowflake so sales ops can join CRM data with product usage and billing.",
    sourceSlug: "salesforce",
    destinationSlug: "snowflake",
    persona: "Sales operations",
    industry: "enterprise",
    benefits: ["Incremental loads", "Enterprise CRM coverage", "Git-native definitions"],
    tags: ["crm", "enterprise"],
  },
  {
    id: "shopify-bigquery",
    title: "Shopify orders & inventory in BigQuery",
    description:
      "Sync orders, products, and inventory levels for merchandising dashboards, LTV models, and demand forecasting.",
    sourceSlug: "shopify_dlt",
    destinationSlug: "bigquery",
    persona: "E-commerce analytics",
    industry: "ecommerce",
    benefits: ["Order-level grain", "Marketing join-ready", "Managed or self-hosted runs"],
    tags: ["ecommerce", "retail"],
  },
  {
    id: "zendesk-postgres",
    title: "Support tickets beside product data",
    description:
      "Replicate Zendesk tickets and users into Postgres (or your warehouse) to correlate CSAT with product events and churn.",
    sourceSlug: "zendesk",
    destinationSlug: "postgres",
    persona: "Customer success",
    industry: "support",
    benefits: ["Ticket history", "Join with app DB", "Incremental sync"],
    tags: ["support", "saas"],
    lakeStarterId: "entity_360_profile",
  },
  {
    id: "google-ads-snowflake",
    title: "Paid media spend in the warehouse",
    description:
      "Load Google Ads campaigns and performance into Snowflake for marketing mix modeling and ROAS reporting alongside Stripe revenue.",
    sourceSlug: "google_ads",
    destinationSlug: "snowflake",
    persona: "Marketing analytics",
    industry: "marketing",
    benefits: ["Campaign-level facts", "Attribution joins", "Schedule nightly syncs"],
    tags: ["marketing", "ads"],
  },
  {
    id: "notion-duckdb",
    title: "Notion docs as queryable tables",
    description:
      "Turn Notion databases into structured tables in DuckDB for ops playbooks, OKR tracking, and lightweight reporting.",
    sourceSlug: "notion",
    destinationSlug: "duckdb",
    persona: "Ops & PM",
    industry: "saas",
    benefits: ["No-code source", "Fast iteration", "Great for prototypes"],
    tags: ["productivity"],
  },
  {
    id: "s3-snowflake",
    title: "Lake files → Snowflake tables",
    description:
      "Ingest CSV, JSON, or Parquet landing in S3 into Snowflake — common for vendor dumps, exports, and batch feeds.",
    sourceSlug: "s3",
    destinationSlug: "snowflake",
    persona: "Data platform",
    industry: "data-platform",
    benefits: ["File-based sources", "Batch-friendly loads", "Partition-friendly"],
    tags: ["files", "lake"],
    lakeStarterId: "single_lake_medallion",
  },
  {
    id: "mysql-redshift",
    title: "MySQL app DB to Redshift",
    description:
      "Mirror MySQL application tables into Redshift for Amazon-native BI stacks and legacy app modernization.",
    sourceSlug: "mysql",
    destinationSlug: "redshift",
    persona: "AWS data teams",
    industry: "data-platform",
    benefits: ["Database replication", "Proven pattern", "BYO execution"],
    tags: ["database", "aws"],
  },
  {
    id: "intercom-bigquery",
    title: "Product conversations in BigQuery",
    description:
      "Sync Intercom users and conversations for NLP pipelines, support deflection analysis, and product feedback loops.",
    sourceSlug: "intercom",
    destinationSlug: "bigquery",
    persona: "Product & support",
    industry: "support",
    benefits: ["Conversation objects", "BigQuery ML ready", "Webhook on run complete"],
    tags: ["support", "product"],
    lakeStarterId: "entity_360_profile",
  },
];

export const DEFAULT_SCENARIO_LAKE_STARTER = "single_source_to_mart";

export function lakeStarterIdForScenario(scenario: PipelineScenario): string {
  return scenario.lakeStarterId ?? DEFAULT_SCENARIO_LAKE_STARTER;
}

export function scenarioCanvasHref(
  pipelineId: string,
  scenario: PipelineScenario,
  pipelineName?: string
): string {
  return canvasStarterHref({
    pipelineId,
    starterId: lakeStarterIdForScenario(scenario),
    pipelineName,
  });
}

export function scenariosForConnector(slug: string): PipelineScenario[] {
  const key = slug.toLowerCase();
  return PIPELINE_SCENARIOS.filter(
    (s) => s.sourceSlug === key || s.destinationSlug === key
  );
}

export function scenarioById(id: string): PipelineScenario | undefined {
  return PIPELINE_SCENARIOS.find((s) => s.id === id);
}

export function scenariosByIndustry(industry: ScenarioIndustry | ""): PipelineScenario[] {
  if (!industry) return PIPELINE_SCENARIOS;
  return PIPELINE_SCENARIOS.filter((s) => s.industry === industry);
}

export const SCENARIO_INDUSTRIES = Object.entries(SCENARIO_INDUSTRY_LABELS) as [ScenarioIndustry, string][];
