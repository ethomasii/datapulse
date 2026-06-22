export interface FeatureComparison {
  category: string;
  rows: {
    feature: string;
    eltpulse: boolean | string;
    competitor: boolean | string;
    note?: string;
  }[];
}

export interface Competitor {
  slug: string;
  name: string;
  tagline: string;
  description: string;
  heroSubtitle: string;
  theyreGoodAt: string[];
  whereTheyFallShort: string[];
  bestFor: string;
  categories: FeatureComparison[];
  closingNote: string;
}

export const COMPETITORS: Competitor[] = [
  {
    slug: "vs-fivetran",
    name: "Fivetran",
    tagline: "eltPulse vs. Fivetran",
    heroSubtitle:
      "Fivetran is the managed ELT benchmark — broad connectors and reliability. eltPulse is for teams who want Git-native definitions and control over where pipelines run.",
    description:
      "Fivetran (now merged with dbt Labs) optimizes for push-button managed ingestion and a unified ingest + transform platform. It excels when you want minimal ops and maximum connector breadth inside one vendor.",
    theyreGoodAt: [
      "Very broad managed connector catalog on day one",
      "Hands-off reliability and operational maturity at scale",
      "Unified ingest + dbt story post-2026 merger",
      "Enterprise contracts, SLAs, and support orgs",
    ],
    whereTheyFallShort: [
      "Pipeline logic lives primarily in-product — Git is secondary to the SaaS model",
      "Consumption pricing (MAR) can be opaque at scale",
      "Less flexibility to run workloads on your own compute without re-architecting",
      "Vendor lock-in when definitions and history are trapped in their control plane",
      "Harder to treat pipelines like application code with PR review and environment promotion",
    ],
    bestFor:
      "Teams that want turnkey managed connectors, minimal platform engineering, and are comfortable with Fivetran’s billing and product model.",
    closingNote:
      "Choose Fivetran when connector breadth and managed reliability matter most and you accept their platform economics. Choose eltPulse when you want definitions in Git, BYO execution, transparent usage pricing, and a control plane you can self-host at Enterprise tier.",
    categories: [
      {
        category: "Pipeline & code model",
        rows: [
          { feature: "Git-native pipeline artifacts", eltpulse: true, competitor: "Integrations exist" },
          { feature: "Declarative YAML + visual builder", eltpulse: true, competitor: "In-product config" },
          { feature: "PR-based environment promotion", eltpulse: true, competitor: "Limited" },
          { feature: "Export to your repo (dlt, Sling, dbt)", eltpulse: true, competitor: "Partial" },
        ],
      },
      {
        category: "Execution & compute",
        rows: [
          { feature: "Run on eltPulse-managed compute", eltpulse: true, competitor: true },
          { feature: "Customer gateway / BYO compute", eltpulse: "All tiers", competitor: false },
          { feature: "Self-hosted control plane", eltpulse: "Enterprise", competitor: false },
          { feature: "Transparent infra pass-through pricing", eltpulse: true, competitor: "Consumption model" },
        ],
      },
      {
        category: "Transforms & quality",
        rows: [
          { feature: "dbt projects & runs", eltpulse: true, competitor: true },
          { feature: "Column lineage (dbt manifest)", eltpulse: "Pro+", competitor: true },
          { feature: "Visual transform canvas", eltpulse: true, competitor: "Via dbt Wizard" },
        ],
      },
      {
        category: "Team & security",
        rows: [
          { feature: "SSO / SAML", eltpulse: "Team+", competitor: true },
          { feature: "Air-gapped metadata export", eltpulse: "Team+", competitor: "Enterprise add-ons" },
          { feature: "Role-based workspace access", eltpulse: "Team+", competitor: true },
        ],
      },
    ],
  },
  {
    slug: "vs-airbyte",
    name: "Airbyte",
    tagline: "eltPulse vs. Airbyte",
    heroSubtitle:
      "Airbyte leads on open-source connector breadth and deployment choice. eltPulse adds a product control plane — catalog, runs, schedules, Git export — without giving up code ownership.",
    description:
      "Airbyte offers a large OSS connector ecosystem, self-hosted Airbyte, and Airbyte Cloud. Teams who love extensibility and running their own data plane often start here.",
    theyreGoodAt: [
      "Huge connector catalog with active OSS community",
      "Self-hosted and cloud deployment options",
      "Forkable open core — extend connectors yourself",
      "Familiar sync-centric mental model",
    ],
    whereTheyFallShort: [
      "You still own ops for self-hosted: upgrades, workers, secrets, observability glue",
      "Less opinionated Git-native workflow for pipeline definitions and review",
      "Product layer for catalog, lineage, and enterprise RBAC varies by deployment",
      "Teams often duct-tape Airbyte with separate orchestration and dbt tooling",
    ],
    bestFor:
      "Engineering teams comfortable operating Airbyte (or paying for Cloud) who prioritize connector extensibility and OSS flexibility.",
    closingNote:
      "Airbyte is a strong sync engine. eltPulse wraps similar open engines (dlt, Sling) with a Lakeflow-style control plane — runs, monitors, catalog, billing, and Git export — so you get product UX without rebuilding observability yourself.",
    categories: [
      {
        category: "Open source & extensibility",
        rows: [
          { feature: "Open-source sync engines", eltpulse: "dlt, Sling", competitor: "Airbyte OSS" },
          { feature: "Self-hosted data plane option", eltpulse: "Gateway + Enterprise CP", competitor: true },
          { feature: "Connector catalog breadth", eltpulse: "Growing", competitor: "Very large" },
          { feature: "Custom connector authoring", eltpulse: "Via engines", competitor: true },
        ],
      },
      {
        category: "Control plane & UX",
        rows: [
          { feature: "Unified runs & telemetry UI", eltpulse: true, competitor: true },
          { feature: "Schedules, monitors, run slices", eltpulse: true, competitor: "Via Airbyte" },
          { feature: "Workspace catalog & asset map", eltpulse: true, competitor: "Limited" },
          { feature: "Managed SaaS shell (no ops)", eltpulse: true, competitor: "Cloud tier" },
        ],
      },
      {
        category: "Pricing",
        rows: [
          { feature: "Free tier", eltpulse: true, competitor: "OSS free / Cloud credits" },
          { feature: "Usage-transparent hosted compute", eltpulse: true, competitor: "Cloud credits" },
          { feature: "BYOC subscription model", eltpulse: "Pro+", competitor: "N/A (self-host)" },
        ],
      },
    ],
  },
  {
    slug: "vs-hevo",
    name: "Hevo",
    tagline: "eltPulse vs. Hevo",
    heroSubtitle:
      "Hevo focuses on approachable managed pipelines and activation. eltPulse targets platform teams who want code in Git, BYO compute, and a longer-horizon self-hosted option.",
    description:
      "Hevo (and similar managed ELT tools) optimize for speed-to-value: connect sources, map fields, activate data — with less emphasis on repo-native workflows or customer-owned execution.",
    theyreGoodAt: [
      "Fast time-to-first-pipeline for analysts and lean data teams",
      "Managed execution — minimal infrastructure to operate",
      "Reverse ETL / activation product lines",
      "Approachable UI for non-platform engineers",
    ],
    whereTheyFallShort: [
      "Less emphasis on Git as source of truth for pipeline definitions",
      "Limited story for self-hosted control plane or air-gapped deployments",
      "Platform engineering teams may outgrow UI-only configuration",
      "Harder to align with internal SDLC (PRs, staging, code review)",
    ],
    bestFor:
      "Teams that want managed pipelines quickly and prefer product UI over repo workflows — especially when reverse ETL or activation is in scope.",
    closingNote:
      "Hevo wins on simplicity and managed speed. eltPulse wins when your data platform team wants definitions in Git, optional self-hosted control plane, customer gateways, and honest usage economics as you scale.",
    categories: [
      {
        category: "Workflow",
        rows: [
          { feature: "UI-first pipeline builder", eltpulse: true, competitor: true },
          { feature: "Git-native artifact export", eltpulse: "Pro+", competitor: false },
          { feature: "API keys & webhook triggers", eltpulse: "Pro+", competitor: true },
          { feature: "dbt integration", eltpulse: true, competitor: "Varies" },
        ],
      },
      {
        category: "Deployment",
        rows: [
          { feature: "Fully managed SaaS", eltpulse: true, competitor: true },
          { feature: "Customer gateway (your VPC)", eltpulse: "All tiers", competitor: false },
          { feature: "Self-hosted control plane", eltpulse: "Enterprise", competitor: false },
          { feature: "Air-gapped metadata export", eltpulse: "Team+", competitor: "Uncommon" },
        ],
      },
      {
        category: "Pricing posture",
        rows: [
          { feature: "Free tier to experiment", eltpulse: true, competitor: "Trial tiers" },
          { feature: "Metered rows beyond included volume", eltpulse: "Pro+", competitor: true },
          { feature: "Annual enterprise platform license", eltpulse: "From $24k/yr", competitor: "Sales-led" },
        ],
      },
    ],
  },
];

export const COMPETITOR_MAP: Record<string, Competitor> = Object.fromEntries(
  COMPETITORS.map((c) => [c.slug, c])
);
