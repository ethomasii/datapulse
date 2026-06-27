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
  /**
   * dlthub.com/context/source/{contextSlug} page exists for this source.
   * When set, the pipeline wizard can fetch a pre-built RESTAPIConfig instead of
   * requiring free-text AI generation. Defaults to `slug` when omitted.
   */
  contextSlug?: string;
  /** "verified" = dlt verified-sources package; "context" = REST API config from dlthub context page only */
  sourceType?: "verified" | "context";
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
    contextSlug: "stripe",
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
    contextSlug: "shopify",
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
    contextSlug: "asana",
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
    contextSlug: "google-sheets",
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
    contextSlug: "google-analytics",
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
    contextSlug: "facebook-ads",
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
    contextSlug: "google-ads",
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
    contextSlug: "bing-webmaster",
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
    contextSlug: "pg-replication",
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
    incremental: true,
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
    sourceType: "verified",
  },
];

/**
 * Sources available via dlthub.com/context/source/{contextSlug} REST API configs.
 * These are NOT dlt verified packages — they use the rest_api_source generic connector
 * with a pre-built RESTAPIConfig fetched at pipeline-creation time.
 */
export const DLT_CONTEXT_SOURCES: DltHubSource[] = [
  // ── CRM & Sales ──────────────────────────────────────────────────────────────
  { slug: "activecampaign", name: "ActiveCampaign", description: "Load contacts, deals, campaigns, and automations from ActiveCampaign.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key", "account_url"], incremental: true, contextSlug: "activecampaign", sourceType: "context" },
  { slug: "zoho-crm", name: "Zoho CRM", description: "Load leads, contacts, accounts, deals, and activities from Zoho CRM.", category: "CRM & Sales", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "zoho-crm", sourceType: "context" },
  { slug: "copper", name: "Copper CRM", description: "Load contacts, leads, opportunities, and companies from Copper.", category: "CRM & Sales", auth: ["API Key + Email"], params: ["api_key", "email"], incremental: true, contextSlug: "copper", sourceType: "context" },
  { slug: "close", name: "Close CRM", description: "Load leads, contacts, opportunities, activities, and sequences from Close.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "close", sourceType: "context" },
  { slug: "keap", name: "Keap (Infusionsoft)", description: "Load contacts, orders, subscriptions, and email campaigns from Keap.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: false, contextSlug: "keap", sourceType: "context" },
  { slug: "quickbooks-online", name: "QuickBooks Online", description: "Load invoices, customers, accounts, transactions, and payments from QuickBooks.", category: "CRM & Sales", auth: ["OAuth 2.0"], params: ["access_token", "realm_id"], incremental: true, contextSlug: "quickbooks-online", sourceType: "context" },
  { slug: "xero-finance", name: "Xero", description: "Load invoices, contacts, accounts, bank transactions, and reports from Xero.", category: "CRM & Sales", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "xero-finance", sourceType: "context" },
  { slug: "linkedin", name: "LinkedIn", description: "Load profile, organizations, shares, and posts from the LinkedIn API.", category: "CRM & Sales", auth: ["OAuth 2.0 Bearer"], params: ["access_token"], incremental: false, contextSlug: "linkedin", sourceType: "context" },

  // ── Marketing ────────────────────────────────────────────────────────────────
  { slug: "mailchimp", name: "Mailchimp", description: "Load lists, campaigns, subscribers, and email activity from Mailchimp.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "mailchimp", sourceType: "context" },
  { slug: "klaviyo", name: "Klaviyo", description: "Load profiles, events, campaigns, flows, and metrics from Klaviyo.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "klaviyo", sourceType: "context" },
  { slug: "braze", name: "Braze", description: "Load campaigns, canvases, segments, and subscription groups from Braze.", category: "Marketing", auth: ["API Key"], params: ["api_key", "instance_url"], incremental: false, contextSlug: "braze", sourceType: "context" },
  { slug: "convertkit", name: "ConvertKit", description: "Load subscribers, forms, sequences, broadcasts, and tags from ConvertKit.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: false, contextSlug: "convertkit", sourceType: "context" },
  { slug: "iterable", name: "Iterable", description: "Load users, campaigns, message types, and events from Iterable.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "iterable", sourceType: "context" },
  { slug: "sendgrid", name: "SendGrid", description: "Load contacts, lists, campaigns, and email stats from SendGrid.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: false, contextSlug: "sendgrid", sourceType: "context" },
  { slug: "segment", name: "Segment", description: "Load sources, destinations, events, and workspace data from Segment.", category: "Analytics", auth: ["API Token"], params: ["access_token"], incremental: false, contextSlug: "segment", sourceType: "context" },
  { slug: "mixpanel", name: "Mixpanel", description: "Load events, funnels, user profiles, and cohorts from Mixpanel.", category: "Analytics", auth: ["Service Account"], params: ["username", "secret", "project_id"], incremental: true, contextSlug: "mixpanel", sourceType: "context" },
  { slug: "amplitude", name: "Amplitude", description: "Load events, user properties, cohorts, and chart data from Amplitude.", category: "Analytics", auth: ["API Key + Secret"], params: ["api_key", "secret_key"], incremental: true, contextSlug: "amplitude", sourceType: "context" },
  { slug: "heap", name: "Heap", description: "Load events, users, sessions, and properties from Heap Analytics.", category: "Analytics", auth: ["API Key"], params: ["api_key", "app_id"], incremental: true, contextSlug: "heap", sourceType: "context" },
  { slug: "posthog", name: "PostHog", description: "Load events, persons, cohorts, dashboards, and feature flags from PostHog.", category: "Analytics", auth: ["API Key"], params: ["api_key", "project_id"], incremental: true, contextSlug: "posthog", sourceType: "context" },

  // ── Support & Ops ─────────────────────────────────────────────────────────────
  { slug: "intercom", name: "Intercom", description: "Load contacts, conversations, events, companies, and articles from Intercom.", category: "Support & Ops", auth: ["Bearer Token"], params: ["access_token"], incremental: true, contextSlug: "intercom", sourceType: "context" },
  { slug: "linear", name: "Linear", description: "Load issues, teams, projects, cycles, and users from Linear.", category: "Support & Ops", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "linear", sourceType: "context" },
  { slug: "monday", name: "Monday.com", description: "Load boards, items, groups, columns, and updates from Monday.com.", category: "Support & Ops", auth: ["API Token"], params: ["api_token"], incremental: false, contextSlug: "monday", sourceType: "context" },
  { slug: "clickup", name: "ClickUp", description: "Load tasks, spaces, lists, folders, goals, and time tracking from ClickUp.", category: "Support & Ops", auth: ["Personal Token"], params: ["api_token"], incremental: true, contextSlug: "clickup", sourceType: "context" },
  { slug: "servicenow", name: "ServiceNow", description: "Load incidents, changes, problems, CMDB records, and users from ServiceNow.", category: "Support & Ops", auth: ["Basic Auth"], params: ["instance_url", "username", "password"], incremental: true, contextSlug: "servicenow", sourceType: "context" },
  { slug: "bamboohr", name: "BambooHR", description: "Load employees, time-off, performance data, and reports from BambooHR.", category: "Support & Ops", auth: ["API Key"], params: ["api_key", "subdomain"], incremental: false, contextSlug: "bamboohr", sourceType: "context" },
  { slug: "okta-management", name: "Okta", description: "Load users, groups, applications, logs, and policies from Okta.", category: "Support & Ops", auth: ["API Token"], params: ["api_token", "domain"], incremental: true, contextSlug: "okta-management", sourceType: "context" },
  { slug: "pagerduty", name: "PagerDuty", description: "Load incidents, services, schedules, escalation policies, and alerts from PagerDuty.", category: "Support & Ops", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "pagerduty", sourceType: "context" },
  { slug: "datadog", name: "Datadog", description: "Load metrics, logs, events, monitors, dashboards, and hosts from Datadog.", category: "Analytics", auth: ["API Key + App Key"], params: ["api_key", "app_key"], incremental: true, contextSlug: "datadog", sourceType: "context" },

  // ── Developer & Code ─────────────────────────────────────────────────────────
  { slug: "gitlab", name: "GitLab", description: "Load projects, issues, merge requests, pipelines, and users from GitLab.", category: "Developer & Code", auth: ["Personal Access Token"], params: ["private_token"], incremental: true, contextSlug: "gitlab", sourceType: "context" },
  { slug: "bitbucket", name: "Bitbucket", description: "Load repositories, pull requests, issues, commits, and pipelines from Bitbucket.", category: "Developer & Code", auth: ["App Password"], params: ["username", "app_password"], incremental: true, contextSlug: "bitbucket", sourceType: "context" },
  { slug: "circleci", name: "CircleCI", description: "Load pipelines, workflows, jobs, insights, and test results from CircleCI.", category: "Developer & Code", auth: ["API Token"], params: ["api_token"], incremental: true, contextSlug: "circleci", sourceType: "context" },
  { slug: "sentry", name: "Sentry", description: "Load projects, issues, events, releases, and performance data from Sentry.", category: "Developer & Code", auth: ["Auth Token"], params: ["auth_token", "organization_slug"], incremental: true, contextSlug: "sentry", sourceType: "context" },

  // ── E-commerce ───────────────────────────────────────────────────────────────
  { slug: "bigcommerce", name: "BigCommerce", description: "Load orders, products, customers, carts, and catalog data from BigCommerce.", category: "CRM & Sales", auth: ["API Key + Store Hash"], params: ["api_key", "store_hash"], incremental: true, contextSlug: "bigcommerce", sourceType: "context" },
  { slug: "woocommerce", name: "WooCommerce", description: "Load orders, products, customers, coupons, and reports from WooCommerce.", category: "CRM & Sales", auth: ["Consumer Key + Secret"], params: ["consumer_key", "consumer_secret", "store_url"], incremental: true, contextSlug: "woocommerce", sourceType: "context" },
  { slug: "etsy", name: "Etsy", description: "Load shops, listings, transactions, and receipts from Etsy.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: false, contextSlug: "etsy", sourceType: "context" },

  // ── Finance ──────────────────────────────────────────────────────────────────
  { slug: "stripe", name: "Stripe (REST API)", description: "Load customers, charges, payment intents, products, and prices via Stripe API.", category: "CRM & Sales", auth: ["Bearer Token (secret key)"], params: ["api_key"], incremental: true, contextSlug: "stripe", sourceType: "context" },
  { slug: "plaid", name: "Plaid", description: "Load transactions, accounts, balances, and institutions from Plaid.", category: "Other", auth: ["Client ID + Secret"], params: ["client_id", "secret"], incremental: true, contextSlug: "plaid", sourceType: "context" },
  { slug: "braintree", name: "Braintree", description: "Load transactions, customers, subscriptions, and disputes from Braintree.", category: "CRM & Sales", auth: ["API Keys"], params: ["merchant_id", "public_key", "private_key"], incremental: true, contextSlug: "braintree", sourceType: "context" },
  { slug: "freshbooks", name: "FreshBooks", description: "Load invoices, clients, expenses, payments, and estimates from FreshBooks.", category: "CRM & Sales", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "freshbooks", sourceType: "context" },

  // ── Cloud & Infrastructure ────────────────────────────────────────────────────
  { slug: "aws-cost-explorer", name: "AWS Cost Explorer", description: "Load cost and usage data, reservations, and savings plans from AWS.", category: "Analytics", auth: ["AWS Credentials"], params: ["aws_access_key_id", "aws_secret_access_key"], incremental: true, contextSlug: "aws-cost-explorer", sourceType: "context" },
  { slug: "github-api", name: "GitHub (REST API)", description: "Load repos, issues, PRs, commits, and events via the GitHub REST API.", category: "Developer & Code", auth: ["Bearer Token"], params: ["token"], incremental: true, contextSlug: "github", sourceType: "context" },
  { slug: "twitch", name: "Twitch", description: "Load streams, games, users, clips, and channel data from Twitch.", category: "Other", auth: ["OAuth 2.0 Client Credentials"], params: ["client_id", "client_secret"], incremental: false, contextSlug: "twitch", sourceType: "context" },
  { slug: "spotify", name: "Spotify", description: "Load playlists, tracks, artists, albums, and listening history from Spotify.", category: "Other", auth: ["OAuth 2.0"], params: ["access_token"], incremental: false, contextSlug: "spotify", sourceType: "context" },

  // ── Additional CRM & Sales ───────────────────────────────────────────────────
  { slug: "pipedrive", name: "Pipedrive", description: "Load deals, contacts, organizations, activities, and pipeline data from Pipedrive.", category: "CRM & Sales", auth: ["API Token"], params: ["api_token"], incremental: true, contextSlug: "pipedrive", sourceType: "context" },
  { slug: "salesloft", name: "Salesloft", description: "Load people, cadences, calls, emails, and activity data from Salesloft.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "salesloft", sourceType: "context" },
  { slug: "outreach", name: "Outreach", description: "Load prospects, sequences, accounts, calls, and mailings from Outreach.", category: "CRM & Sales", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "outreach", sourceType: "context" },
  { slug: "apollo", name: "Apollo.io", description: "Load contacts, accounts, sequences, and enrichment data from Apollo.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "apollo", sourceType: "context" },
  { slug: "gorgias", name: "Gorgias", description: "Load tickets, customers, messages, and satisfaction scores from Gorgias.", category: "Support & Ops", auth: ["API Key + Email"], params: ["api_key", "email", "domain"], incremental: true, contextSlug: "gorgias", sourceType: "context" },
  { slug: "front", name: "Front", description: "Load conversations, contacts, inboxes, teammates, and tags from Front.", category: "Support & Ops", auth: ["API Token"], params: ["api_token"], incremental: true, contextSlug: "front", sourceType: "context" },
  { slug: "helpscout", name: "Help Scout", description: "Load conversations, customers, mailboxes, and reports from Help Scout.", category: "Support & Ops", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "helpscout", sourceType: "context" },

  // ── Additional Marketing ─────────────────────────────────────────────────────
  { slug: "marketo", name: "Marketo", description: "Load leads, activities, campaigns, programs, and email stats from Marketo.", category: "Marketing", auth: ["Client ID + Secret"], params: ["client_id", "client_secret", "base_url"], incremental: true, contextSlug: "marketo", sourceType: "context" },
  { slug: "pardot", name: "Salesforce Pardot", description: "Load prospects, opportunities, campaigns, and visitors from Pardot.", category: "Marketing", auth: ["API Key"], params: ["api_key", "user_key"], incremental: true, contextSlug: "pardot", sourceType: "context" },
  { slug: "drip", name: "Drip", description: "Load subscribers, events, tags, workflows, and broadcasts from Drip.", category: "Marketing", auth: ["API Token"], params: ["api_token"], incremental: false, contextSlug: "drip", sourceType: "context" },
  { slug: "customer-io", name: "Customer.io", description: "Load customers, events, campaigns, newsletters, and segments from Customer.io.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "customer-io", sourceType: "context" },
  { slug: "tiktok-ads", name: "TikTok Ads", description: "Load campaigns, ad groups, ads, audiences, and performance metrics from TikTok Ads.", category: "Marketing", auth: ["Access Token"], params: ["access_token", "advertiser_id"], incremental: true, contextSlug: "tiktok-ads", sourceType: "context" },
  { slug: "twitter-ads", name: "Twitter Ads", description: "Load campaigns, line items, creatives, and analytics from Twitter Ads.", category: "Marketing", auth: ["OAuth 1.0a"], params: ["consumer_key", "consumer_secret", "access_token", "access_token_secret"], incremental: true, contextSlug: "twitter-ads", sourceType: "context" },
  { slug: "pinterest-ads", name: "Pinterest Ads", description: "Load campaigns, ad groups, ads, and analytics from Pinterest Ads.", category: "Marketing", auth: ["Access Token"], params: ["access_token"], incremental: true, contextSlug: "pinterest-ads", sourceType: "context" },
  { slug: "linkedin-ads", name: "LinkedIn Ads", description: "Load campaigns, creatives, ad analytics, and audience insights from LinkedIn Ads.", category: "Marketing", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "linkedin-ads", sourceType: "context" },

  // ── Additional Analytics ─────────────────────────────────────────────────────
  { slug: "fullstory", name: "FullStory", description: "Load sessions, events, and user data from FullStory.", category: "Analytics", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "fullstory", sourceType: "context" },
  { slug: "appsflyer", name: "AppsFlyer", description: "Load installs, in-app events, attribution, and LTV data from AppsFlyer.", category: "Analytics", auth: ["API Token"], params: ["api_token", "app_id"], incremental: true, contextSlug: "appsflyer", sourceType: "context" },
  { slug: "adjust", name: "Adjust", description: "Load deliverables, events, cohorts, and attribution data from Adjust.", category: "Analytics", auth: ["User Token"], params: ["user_token"], incremental: true, contextSlug: "adjust", sourceType: "context" },
  { slug: "chartmogul", name: "ChartMogul", description: "Load MRR, ARR, churn, customers, and subscription data from ChartMogul.", category: "Analytics", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "chartmogul", sourceType: "context" },

  // ── Additional Developer & Code ──────────────────────────────────────────────
  { slug: "jira-api", name: "Jira (REST API)", description: "Load issues, projects, sprints, boards, and users via the Jira REST API.", category: "Developer & Code", auth: ["API Token + Email"], params: ["api_token", "email", "domain"], incremental: true, contextSlug: "jira", sourceType: "context" },
  { slug: "jenkins", name: "Jenkins", description: "Load jobs, builds, test results, and pipeline runs from Jenkins.", category: "Developer & Code", auth: ["API Token"], params: ["api_token", "base_url"], incremental: true, contextSlug: "jenkins", sourceType: "context" },
  { slug: "sonarqube", name: "SonarQube", description: "Load projects, issues, measures, and quality gates from SonarQube.", category: "Developer & Code", auth: ["Token"], params: ["token", "base_url"], incremental: true, contextSlug: "sonarqube", sourceType: "context" },
  { slug: "launchdarkly", name: "LaunchDarkly", description: "Load feature flags, environments, projects, and audit logs from LaunchDarkly.", category: "Developer & Code", auth: ["Access Token"], params: ["access_token"], incremental: false, contextSlug: "launchdarkly", sourceType: "context" },

  // ── HR & Workforce ───────────────────────────────────────────────────────────
  { slug: "workday", name: "Workday", description: "Load workers, positions, organizations, and compensation data from Workday.", category: "Support & Ops", auth: ["Basic Auth"], params: ["username", "password", "tenant"], incremental: false, contextSlug: "workday", sourceType: "context" },
  { slug: "gusto", name: "Gusto", description: "Load employees, payroll, benefits, and time-off data from Gusto.", category: "Support & Ops", auth: ["OAuth 2.0"], params: ["access_token"], incremental: false, contextSlug: "gusto", sourceType: "context" },
  { slug: "greenhouse", name: "Greenhouse", description: "Load candidates, jobs, applications, interviews, and offers from Greenhouse.", category: "Support & Ops", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "greenhouse", sourceType: "context" },
  { slug: "lever", name: "Lever", description: "Load candidates, opportunities, postings, and feedback from Lever.", category: "Support & Ops", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "lever", sourceType: "context" },

  // ── Finance & Accounting ─────────────────────────────────────────────────────
  { slug: "netsuite", name: "NetSuite", description: "Load records, transactions, customers, and reports from NetSuite.", category: "CRM & Sales", auth: ["Token-based Auth"], params: ["account_id", "consumer_key", "consumer_secret", "token_id", "token_secret"], incremental: true, contextSlug: "netsuite", sourceType: "context" },
  { slug: "chargebee", name: "Chargebee", description: "Load subscriptions, customers, invoices, and revenue metrics from Chargebee.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key", "site"], incremental: true, contextSlug: "chargebee", sourceType: "context" },
  { slug: "recurly", name: "Recurly", description: "Load accounts, subscriptions, invoices, transactions, and plans from Recurly.", category: "CRM & Sales", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "recurly", sourceType: "context" },

  // ── Productivity & Collaboration ─────────────────────────────────────────────
  { slug: "confluence", name: "Confluence", description: "Load spaces, pages, blog posts, comments, and attachments from Confluence.", category: "Support & Ops", auth: ["API Token + Email"], params: ["api_token", "email", "domain"], incremental: true, contextSlug: "confluence", sourceType: "context" },
  { slug: "google-workspace", name: "Google Workspace", description: "Load users, groups, drives, and admin reports from Google Workspace.", category: "Support & Ops", auth: ["Service Account"], params: ["service_account_json"], incremental: false, contextSlug: "google-workspace", sourceType: "context" },
  { slug: "microsoft-teams", name: "Microsoft Teams", description: "Load teams, channels, messages, meetings, and users from Microsoft Teams.", category: "Support & Ops", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "microsoft-teams", sourceType: "context" },
  { slug: "zoom", name: "Zoom", description: "Load meetings, webinars, participants, recordings, and users from Zoom.", category: "Support & Ops", auth: ["OAuth 2.0"], params: ["access_token"], incremental: true, contextSlug: "zoom", sourceType: "context" },

  // ── E-commerce & Retail ──────────────────────────────────────────────────────
  { slug: "magento", name: "Magento / Adobe Commerce", description: "Load orders, products, customers, categories, and inventory from Magento.", category: "CRM & Sales", auth: ["Admin Token"], params: ["admin_token", "base_url"], incremental: true, contextSlug: "magento", sourceType: "context" },
  { slug: "recharge", name: "Recharge", description: "Load subscriptions, orders, customers, and products from Recharge.", category: "CRM & Sales", auth: ["API Token"], params: ["api_token"], incremental: true, contextSlug: "recharge", sourceType: "context" },
  { slug: "klaviyo-ecommerce", name: "Klaviyo E-commerce", description: "Load orders, products, and catalog events via Klaviyo's e-commerce integrations.", category: "Marketing", auth: ["API Key"], params: ["api_key"], incremental: true, contextSlug: "klaviyo", sourceType: "context" },
];

/** All sources: verified dlt packages + context-page REST API sources */
export const ALL_DLT_SOURCES: DltHubSource[] = [...DLT_HUB_SOURCES, ...DLT_CONTEXT_SOURCES];

/** Quick lookup by slug */
export const DLT_HUB_SOURCE_BY_SLUG = Object.fromEntries(
  ALL_DLT_SOURCES.map((s) => [s.slug, s])
) as Record<string, DltHubSource | undefined>;

/** All slugs that have a dlt verified source */
export const DLT_VERIFIED_SLUGS = new Set(DLT_HUB_SOURCES.map((s) => s.slug));

/** All slugs that have a dlthub context page (verified + context sources) */
export const DLT_CONTEXT_SLUGS = new Set(
  ALL_DLT_SOURCES.map((s) => s.contextSlug ?? s.slug)
);

/** Return enriched metadata for a source slug, or undefined if not in registry */
export function getDltHubSource(slug: string): DltHubSource | undefined {
  return DLT_HUB_SOURCE_BY_SLUG[slug.toLowerCase().trim()];
}

/** Sources grouped by category for the registry browser UI */
export function getDltHubSourcesByCategory(): Record<string, DltHubSource[]> {
  const result: Record<string, DltHubSource[]> = {};
  for (const source of ALL_DLT_SOURCES) {
    if (!result[source.category]) result[source.category] = [];
    result[source.category].push(source);
  }
  return result;
}

/** The context slug to use for fetching dlthub.com/context/source/{slug} */
export function getContextSlug(source: DltHubSource): string {
  return source.contextSlug ?? source.slug;
}
