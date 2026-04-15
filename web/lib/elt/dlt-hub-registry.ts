/**
 * dlt Hub / verified-sources registry.
 *
 * Maps every dlt verified source to display metadata so the AI builder and
 * the source picker can surface richer information than a bare slug.
 *
 * Verified source list: https://github.com/dlt-hub/verified-sources/tree/master/sources
 * Install pattern:  dlt init <source> <destination>
 */

export type DltHubSource = {
  /** Slug used with `dlt init` and in pipeline code */
  slug: string;
  /** Human-readable name */
  name: string;
  /** Short description */
  description: string;
  /** Category for grouping in the UI */
  category: "CRM & Sales" | "Marketing" | "Support & Ops" | "Developer & Code" | "Storage & Files" | "Databases" | "Analytics" | "Productivity" | "Other";
  /** Auth mechanism(s) */
  auth: string[];
  /** Key config parameters */
  params: string[];
  /** Whether this source supports incremental / partition_key loading */
  incremental: boolean;
  /** dlt verified source package name (if different from slug) */
  package?: string;
  /** Link to verified source docs */
  docsUrl?: string;
};

export const DLT_HUB_SOURCES: DltHubSource[] = [
  {
    slug: "github",
    name: "GitHub",
    description: "Load issues, pull requests, reactions, stargazers, and events from any GitHub repository.",
    category: "Developer & Code",
    auth: ["Personal Access Token (GITHUB_TOKEN)"],
    params: ["repo_owner", "repo_name", "resources", "items_per_page"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/github",
  },
  {
    slug: "stripe_analytics",
    name: "Stripe",
    description: "Load payments, customers, subscriptions, invoices, charges, and events from Stripe.",
    category: "CRM & Sales",
    auth: ["API Key (STRIPE_API_KEY)"],
    params: ["start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/stripe_analytics",
  },
  {
    slug: "shopify_dlt",
    name: "Shopify",
    description: "Load orders, products, customers, collections, and inventory from a Shopify store.",
    category: "CRM & Sales",
    auth: ["API Key + Store domain"],
    params: ["private_app_password", "store_url", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/shopify_dlt",
  },
  {
    slug: "hubspot",
    name: "HubSpot",
    description: "Load contacts, companies, deals, tickets, engagements, and web analytics from HubSpot.",
    category: "CRM & Sales",
    auth: ["Private App Access Token"],
    params: ["api_key", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/hubspot",
  },
  {
    slug: "salesforce",
    name: "Salesforce",
    description: "Load Accounts, Contacts, Opportunities, Leads, Cases, and custom objects from Salesforce.",
    category: "CRM & Sales",
    auth: ["Username + Password + Security Token"],
    params: ["user_name", "password", "security_token"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/salesforce",
  },
  {
    slug: "pipedrive",
    name: "Pipedrive",
    description: "Load deals, persons, organizations, activities, and pipeline stages from Pipedrive CRM.",
    category: "CRM & Sales",
    auth: ["API Token"],
    params: ["api_token"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/pipedrive",
  },
  {
    slug: "freshdesk",
    name: "Freshdesk",
    description: "Load tickets, contacts, agents, groups, and satisfaction ratings from Freshdesk.",
    category: "Support & Ops",
    auth: ["API Key"],
    params: ["domain", "api_key"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/freshdesk",
  },
  {
    slug: "zendesk",
    name: "Zendesk Support",
    description: "Load tickets, users, organizations, ticket events, and satisfaction ratings from Zendesk.",
    category: "Support & Ops",
    auth: ["Subdomain + Email + API Token"],
    params: ["subdomain", "email", "token", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/zendesk",
  },
  {
    slug: "jira",
    name: "Jira",
    description: "Load issues, projects, boards, sprints, users, and worklogs from Jira Cloud or Server.",
    category: "Support & Ops",
    auth: ["Email + API Token"],
    params: ["subdomain", "email", "api_token"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/jira",
  },
  {
    slug: "asana_dlt",
    name: "Asana",
    description: "Load projects, tasks, stories, users, teams, and workspaces from Asana.",
    category: "Support & Ops",
    auth: ["Personal Access Token"],
    params: ["access_token"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/asana_dlt",
  },
  {
    slug: "workable",
    name: "Workable",
    description: "Load jobs, candidates, stages, and members from Workable ATS.",
    category: "Support & Ops",
    auth: ["API Token + Subdomain"],
    params: ["access_token", "account_subdomain"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/workable",
  },
  {
    slug: "slack",
    name: "Slack",
    description: "Load messages, channels, users, threads, and reactions from a Slack workspace.",
    category: "Productivity",
    auth: ["Bot OAuth Token"],
    params: ["access_token", "start_date", "channel_list"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/slack",
  },
  {
    slug: "notion",
    name: "Notion",
    description: "Load databases, pages, blocks, and comments from Notion via the Integration API.",
    category: "Productivity",
    auth: ["Integration Token"],
    params: ["database_ids"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/notion",
  },
  {
    slug: "airtable",
    name: "Airtable",
    description: "Load tables and views from any Airtable base.",
    category: "Productivity",
    auth: ["Personal Access Token"],
    params: ["access_token", "base_id", "table_names"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/airtable",
  },
  {
    slug: "google_sheets",
    name: "Google Sheets",
    description: "Load named ranges and sheet tabs from Google Sheets via service account.",
    category: "Productivity",
    auth: ["Service Account JSON"],
    params: ["spreadsheet_url", "range_names"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/google_sheets",
  },
  {
    slug: "google_analytics",
    name: "Google Analytics (GA4)",
    description: "Load sessions, events, conversions, and attribution data from Google Analytics 4.",
    category: "Analytics",
    auth: ["Service Account JSON or OAuth"],
    params: ["property_id", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/google_analytics",
  },
  {
    slug: "facebook_ads",
    name: "Facebook Ads",
    description: "Load campaigns, ad sets, ads, insights, and creative details from Facebook/Meta Ads.",
    category: "Marketing",
    auth: ["Access Token + Account ID"],
    params: ["access_token", "account_id", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/facebook_ads",
  },
  {
    slug: "google_ads",
    name: "Google Ads",
    description: "Load campaigns, ad groups, keywords, and performance metrics from Google Ads.",
    category: "Marketing",
    auth: ["OAuth + Developer Token"],
    params: ["developer_token", "customer_id", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/google_ads",
  },
  {
    slug: "bing_webmaster",
    name: "Bing Webmaster",
    description: "Load page stats, keyword performance, and crawl data from Bing Webmaster Tools.",
    category: "Marketing",
    auth: ["API Key"],
    params: ["api_key"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/bing_webmaster",
  },
  {
    slug: "matomo",
    name: "Matomo",
    description: "Load visits, events, goals, and ecommerce data from a self-hosted Matomo instance.",
    category: "Analytics",
    auth: ["Token Auth + Site URL"],
    params: ["url", "token_auth", "site_id", "start_date"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/matomo",
  },
  {
    slug: "filesystem",
    name: "Filesystem / Cloud Storage",
    description: "Load files (CSV, JSON, Parquet, JSONL) from local disk, S3, GCS, or Azure Blob Storage.",
    category: "Storage & Files",
    auth: ["Cloud credentials (env vars)"],
    params: ["bucket_url", "file_glob"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/filesystem",
  },
  {
    slug: "sql_database",
    name: "SQL Database",
    description: "Load tables from any SQLAlchemy-compatible database (Postgres, MySQL, SQLite, MSSQL, Oracle).",
    category: "Databases",
    auth: ["Connection string"],
    params: ["credentials", "schema", "table_names"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/sql_database",
  },
  {
    slug: "mongodb",
    name: "MongoDB",
    description: "Load collections from MongoDB Atlas or self-hosted MongoDB.",
    category: "Databases",
    auth: ["Connection URI"],
    params: ["connection_url", "database", "collection_names"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/mongodb",
  },
  {
    slug: "pg_replication",
    name: "Postgres Replication (CDC)",
    description: "Stream row-level changes from Postgres via logical replication (change data capture).",
    category: "Databases",
    auth: ["Postgres connection string with replication role"],
    params: ["credentials", "slot_name", "publication_name"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/pg_replication",
  },
  {
    slug: "kafka",
    name: "Apache Kafka",
    description: "Consume messages from Kafka topics and load them into a destination.",
    category: "Databases",
    auth: ["Bootstrap servers + credentials"],
    params: ["bootstrap_servers", "group_id", "topics"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/kafka",
  },
  {
    slug: "kinesis",
    name: "AWS Kinesis",
    description: "Consume records from AWS Kinesis Data Streams.",
    category: "Databases",
    auth: ["AWS credentials"],
    params: ["stream_name", "region"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/kinesis",
  },
  {
    slug: "rest_api",
    name: "REST API",
    description: "Connect to any REST API with configurable auth, pagination, and data selectors.",
    category: "Other",
    auth: ["None / Bearer Token / API Key / Basic Auth"],
    params: ["base_url", "endpoint", "http_method", "pagination_type", "data_selector"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/rest_api",
  },
  {
    slug: "inbox",
    name: "Email Inbox (IMAP)",
    description: "Load emails and attachments from an IMAP mailbox.",
    category: "Productivity",
    auth: ["IMAP host + credentials"],
    params: ["host", "email_account", "password"],
    incremental: true,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/inbox",
  },
  {
    slug: "personio",
    name: "Personio",
    description: "Load employees, absences, attendances, and positions from Personio HR.",
    category: "Support & Ops",
    auth: ["Client ID + Client Secret"],
    params: ["client_id", "client_secret"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/personio",
  },
  {
    slug: "mux",
    name: "Mux Video",
    description: "Load video assets, playback stats, and errors from Mux video analytics.",
    category: "Analytics",
    auth: ["Token ID + Token Secret"],
    params: ["token_id", "token_secret"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/mux",
  },
  {
    slug: "strapi",
    name: "Strapi",
    description: "Load content types and entries from a self-hosted or cloud Strapi CMS.",
    category: "Other",
    auth: ["API Token + Base URL"],
    params: ["api_secret_key", "domain"],
    incremental: false,
    docsUrl: "https://github.com/dlt-hub/verified-sources/tree/master/sources/strapi",
  },
];

/** Quick lookup by slug */
export const DLT_HUB_SOURCE_BY_SLUG = Object.fromEntries(
  DLT_HUB_SOURCES.map((s) => [s.slug, s])
) as Record<string, DltHubSource | undefined>;

/** All slugs that have a dlt verified source */
export const DLT_VERIFIED_SLUGS = new Set(DLT_HUB_SOURCES.map((s) => s.slug));

/** Return enriched metadata for a source slug, or undefined if not in registry */
export function getDltHubSource(slug: string): DltHubSource | undefined {
  return DLT_HUB_SOURCE_BY_SLUG[slug.toLowerCase().trim()];
}

/** Sources grouped by category for the registry browser UI */
export function getDltHubSourcesByCategory(): Record<string, DltHubSource[]> {
  const result: Record<string, DltHubSource[]> = {};
  for (const source of DLT_HUB_SOURCES) {
    if (!result[source.category]) result[source.category] = [];
    result[source.category].push(source);
  }
  return result;
}
