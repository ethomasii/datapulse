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
  {
    slug: "vs-matillion",
    name: "Matillion",
    tagline: "eltPulse vs. Matillion",
    heroSubtitle:
      "Matillion excels at in-warehouse ELT with a visual builder and pushdown transforms. eltPulse is for teams who want portable, Git-native definitions and choice of where sync workloads run.",
    description:
      "Matillion (Data Productivity Cloud) targets analytics teams on Snowflake, Databricks, and Redshift — load data, transform inside the warehouse, orchestrate with a GUI. Credit-based pricing plus warehouse compute is the economic model.",
    theyreGoodAt: [
      "Visual pipeline builder with warehouse-native pushdown performance",
      "Strong fit for Snowflake / Databricks-centric analytics orgs",
      "DevOps integrations and enterprise deployment patterns",
      "Maia agentic AI for pipeline assistance (2025+)",
    ],
    whereTheyFallShort: [
      "Credit-based pricing plus warehouse compute — total cost can be hard to forecast",
      "Smaller connector catalog than ingestion-first platforms (Fivetran, Airbyte)",
      "Definitions live in Matillion — Git is supplementary, not the center of gravity",
      "Less natural fit when you want extract/load on your own gateways outside the warehouse",
      "Air-gapped or self-hosted control plane is not the core product story",
    ],
    bestFor:
      "Teams standardized on one cloud warehouse who want GUI-driven ELT with transforms running inside Snowflake, Databricks, or Redshift.",
    closingNote:
      "Matillion wins when warehouse pushdown and visual ELT are the whole game. eltPulse wins when you want open sync engines, Git-exported artifacts, BYO compute on any tier, and an optional self-hosted control plane for Enterprise.",
    categories: [
      {
        category: "Architecture",
        rows: [
          { feature: "Extract/load outside warehouse", eltpulse: true, competitor: "Limited" },
          { feature: "Transform in warehouse (dbt/SQL)", eltpulse: true, competitor: true },
          { feature: "Git-native source of truth", eltpulse: true, competitor: "Partial" },
          { feature: "Visual pipeline builder", eltpulse: true, competitor: true },
        ],
      },
      {
        category: "Deployment & economics",
        rows: [
          { feature: "Customer gateway / BYO sync compute", eltpulse: "All tiers", competitor: false },
          { feature: "Self-hosted control plane", eltpulse: "Enterprise", competitor: false },
          { feature: "Pricing model", eltpulse: "Sub + usage", competitor: "Credits + warehouse" },
          { feature: "Free tier to experiment", eltpulse: true, competitor: "Trial" },
        ],
      },
      {
        category: "Connectors & catalog",
        rows: [
          { feature: "Connector breadth", eltpulse: "Growing (dlt/Sling)", competitor: "~120+" },
          { feature: "Workspace catalog & lineage", eltpulse: true, competitor: true },
          { feature: "dbt project integration", eltpulse: true, competitor: true },
        ],
      },
    ],
  },
  {
    slug: "vs-maia",
    name: "Maia (Matillion)",
    tagline: "eltPulse vs. Maia",
    heroSubtitle:
      "Maia is Matillion’s agentic AI for building pipelines in natural language — inside their cloud. eltPulse pairs AI-assisted authoring with Git-exported artifacts you own.",
    description:
      "Maia launched in 2025 as part of Matillion’s Data Productivity Cloud: virtual data engineers that generate pipelines, SQL, tests, and docs from prompts. It’s compelling for speed inside Matillion’s product boundary — not a standalone platform.",
    theyreGoodAt: [
      "Natural-language pipeline generation inside Matillion",
      "Automates repetitive ELT tasks (testing, docs, debugging assists)",
      "Lowers the bar for analysts to request transformations",
      "Tight integration with Matillion orchestration and warehouse pushdown",
    ],
    whereTheyFallShort: [
      "Requires Matillion Data Productivity Cloud — not portable to other stacks",
      "AI output lives in vendor UI; harder to PR-review like application code",
      "No independent Git-native export or BYO gateway story",
      "Agent capabilities are tied to Matillion credit pricing and warehouse compute",
      "Less suited when compliance requires air-gapped metadata or self-hosted control plane",
    ],
    bestFor:
      "Teams already on Matillion who want AI to accelerate pipeline work without leaving the Matillion ecosystem.",
    closingNote:
      "Maia is AI inside a single vendor’s ELT product. eltPulse offers AI-assisted pipeline building too — but artifacts export to your repo, run on your gateways or managed workers, and stay portable if you change vendors.",
    categories: [
      {
        category: "AI-assisted building",
        rows: [
          { feature: "Natural-language pipeline help", eltpulse: "AI builder", competitor: true },
          { feature: "Generates reviewable repo artifacts", eltpulse: true, competitor: "In-product" },
          { feature: "dbt / YAML / code export", eltpulse: "Pro+", competitor: "Matillion-native" },
          { feature: "Works without vendor lock-in", eltpulse: true, competitor: false },
        ],
      },
      {
        category: "Platform scope",
        rows: [
          { feature: "Standalone product", eltpulse: true, competitor: "Matillion add-on" },
          { feature: "Open sync engines (dlt, Sling)", eltpulse: true, competitor: false },
          { feature: "Runs API & observability", eltpulse: "Pro+", competitor: "Via Matillion" },
          { feature: "Self-hosted / air-gap options", eltpulse: "Enterprise / Team+", competitor: false },
        ],
      },
      {
        category: "Who it serves",
        rows: [
          { feature: "Platform engineering teams", eltpulse: true, competitor: "Matillion admins" },
          { feature: "Analyst self-serve", eltpulse: "Canvas + AI", competitor: true },
          { feature: "SDLC (PRs, staging, prod)", eltpulse: true, competitor: "Limited" },
        ],
      },
    ],
  },
  {
    slug: "vs-meltano",
    name: "Meltano",
    tagline: "eltPulse vs. Meltano",
    heroSubtitle:
      "Meltano is the open-source ‘dataops OS’ — Singer taps, dbt, and plugins as code. eltPulse adds a managed control plane for teams who want product UX without assembling the stack themselves.",
    description:
      "Meltano (now part of the Arch ecosystem) treats data integration as a software project: meltano.yml, Singer taps/targets, dbt, and CLI-first workflows. It’s beloved by engineers who want maximum control and minimal vendor.",
    theyreGoodAt: [
      "Fully open-source, CLI-native, extensible plugin model",
      "Singer ecosystem — huge tap/target catalog",
      "Git-friendly project structure (meltano.yml)",
      "No platform subscription for the core OSS",
    ],
    whereTheyFallShort: [
      "You assemble and operate the full stack: schedulers, secrets, observability, UI",
      "No built-in multi-tenant SaaS shell for business users",
      "Connector quality varies across Singer taps — maintenance is on you",
      "Enterprise RBAC, billing, and managed compute are DIY or partner-led",
    ],
    bestFor:
      "Engineering-led data teams who want OSS flexibility, are comfortable with CLI workflows, and will wire their own orchestration and monitoring.",
    closingNote:
      "Meltano is the toolkit. eltPulse is the product layer on similar open engines — visual builder, runs UI, catalog, tier gates, Stripe billing, and optional managed workers — while still exporting Git-native artifacts.",
    categories: [
      {
        category: "Open source & portability",
        rows: [
          { feature: "Open-source core", eltpulse: "OSS + SaaS", competitor: true },
          { feature: "CLI-first workflow", eltpulse: "UI + API", competitor: true },
          { feature: "Singer tap ecosystem", eltpulse: "dlt, Sling", competitor: "Singer native" },
          { feature: "meltano.yml / declarative project", eltpulse: "YAML + canvas", competitor: true },
        ],
      },
      {
        category: "Product & ops",
        rows: [
          { feature: "Hosted SaaS (no infra)", eltpulse: true, competitor: "Self-host / partner" },
          { feature: "Runs & telemetry UI", eltpulse: true, competitor: "Plugins / DIY" },
          { feature: "Schedules & monitors built-in", eltpulse: true, competitor: "Via Airflow etc." },
          { feature: "Usage billing & plans", eltpulse: true, competitor: false },
        ],
      },
      {
        category: "Team features",
        rows: [
          { feature: "Workspace RBAC", eltpulse: "Team+", competitor: "DIY" },
          { feature: "SSO / SAML", eltpulse: "Team+", competitor: "DIY" },
          { feature: "Customer gateway tokens", eltpulse: "All tiers", competitor: "Self-host" },
        ],
      },
    ],
  },
  {
    slug: "vs-stitch",
    name: "Stitch",
    tagline: "eltPulse vs. Stitch",
    heroSubtitle:
      "Stitch (Talend) is a straightforward managed Singer pipeline service. eltPulse goes further on Git-native definitions, transforms, and BYO compute.",
    description:
      "Stitch Data popularized managed Singer: pick sources, load to a warehouse, pay by row volume. Talend acquired Stitch; it remains a simple ingestion-focused option for teams who don’t need a full control plane.",
    theyreGoodAt: [
      "Simple managed ingestion — fast to first sync",
      "Singer-compatible mental model",
      "Predictable entry pricing for small teams",
      "Part of Talend’s broader data integration portfolio",
    ],
    whereTheyFallShort: [
      "Ingestion-first — limited native transform/orchestration story",
      "Definitions live in Stitch, not your Git repo",
      "No customer gateway or self-hosted control plane path",
      "Less suited for complex dbt workflows and platform engineering SDLC",
    ],
    bestFor:
      "Small teams that need reliable SaaS ingestion into a warehouse and will handle transforms separately (dbt, SQL, Matillion, etc.).",
    closingNote:
      "Stitch is a solid managed loader. eltPulse covers load plus transforms, catalog, monitors, Git export, and optional BYO compute — one control plane instead of stitching tools together.",
    categories: [
      {
        category: "Scope",
        rows: [
          { feature: "Managed ingestion", eltpulse: true, competitor: true },
          { feature: "dbt runs & manifest lineage", eltpulse: true, competitor: false },
          { feature: "Visual pipeline builder", eltpulse: true, competitor: "Limited" },
          { feature: "Git artifact export", eltpulse: "Pro+", competitor: false },
        ],
      },
      {
        category: "Operations",
        rows: [
          { feature: "Run history & telemetry", eltpulse: true, competitor: true },
          { feature: "Webhook triggers", eltpulse: "Pro+", competitor: "Limited" },
          { feature: "Customer gateway", eltpulse: "All tiers", competitor: false },
          { feature: "Self-hosted control plane", eltpulse: "Enterprise", competitor: false },
        ],
      },
      {
        category: "Pricing",
        rows: [
          { feature: "Free tier", eltpulse: true, competitor: "Row-limited free" },
          { feature: "Transparent usage metering", eltpulse: true, competitor: "Row tiers" },
        ],
      },
    ],
  },
  {
    slug: "vs-portable",
    name: "Portable",
    tagline: "eltPulse vs. Portable",
    heroSubtitle:
      "Portable builds long-tail connectors on demand. eltPulse is a full pipeline control plane — catalog, runs, transforms, and Git — not just connector coverage.",
    description:
      "Portable (Portable.io) focuses on niche and long-tail SaaS connectors that larger catalogs miss. Teams use it when they need a specific source and can’t wait for Fivetran or Airbyte to ship it.",
    theyreGoodAt: [
      "Custom and long-tail connector development",
      "Fast turnaround for niche SaaS sources",
      "Managed pipeline service for specific integrations",
      "Good fit when catalog gaps block a project",
    ],
    whereTheyFallShort: [
      "Not a general-purpose ELT control plane or transform platform",
      "Limited Git-native and platform engineering story",
      "Pricing scales per connector / usage — can add up across many sources",
      "Teams still need orchestration, dbt, catalog, and governance elsewhere",
    ],
    bestFor:
      "Teams blocked on one or two obscure sources who need a connector built and hosted quickly.",
    closingNote:
      "Portable solves connector gaps. eltPulse is the platform around sync engines — use Portable (or any tap) where needed, but run definitions, schedules, dbt, and observability in one Git-friendly control plane.",
    categories: [
      {
        category: "Product focus",
        rows: [
          { feature: "Full ELT control plane", eltpulse: true, competitor: "Connectors-first" },
          { feature: "Long-tail custom connectors", eltpulse: "Growing catalog", competitor: true },
          { feature: "dbt & transform canvas", eltpulse: true, competitor: false },
          { feature: "Workspace catalog", eltpulse: true, competitor: false },
        ],
      },
      {
        category: "Engineering workflow",
        rows: [
          { feature: "Git-native exports", eltpulse: "Pro+", competitor: false },
          { feature: "API keys & runs API", eltpulse: "Pro+", competitor: "Limited" },
          { feature: "BYO gateway execution", eltpulse: "All tiers", competitor: false },
        ],
      },
      {
        category: "When to use both",
        rows: [
          { feature: "Obscure SaaS source needed", eltpulse: "Catalog + partners", competitor: true },
          { feature: "End-to-end platform", eltpulse: true, competitor: "Point solution" },
        ],
      },
    ],
  },
  {
    slug: "vs-dbt-cloud",
    name: "dbt Cloud",
    tagline: "eltPulse vs. dbt Cloud",
    heroSubtitle:
      "dbt Cloud owns the T in ELT — models, tests, docs. eltPulse covers ingest + orchestration + Git and integrates dbt; they complement more than compete.",
    description:
      "dbt Cloud (dbt Labs) is the managed home for analytics engineering: develop models, run jobs, expose docs and lineage. After the Fivetran merger, it increasingly sits inside a broader ingest + transform story — but dbt Cloud alone is not an ingestion platform.",
    theyreGoodAt: [
      "Best-in-class dbt developer experience and job orchestration",
      "Semantic layer, docs site, and model lineage",
      "Large community and package ecosystem",
      "Enterprise governance for analytics code",
    ],
    whereTheyFallShort: [
      "Not an EL tool — you bring Fivetran, Airbyte, or custom loaders",
      "No native customer gateway or extract/load connector catalog",
      "Full-stack teams still need a separate ingest control plane",
      "Post-merger bundling may push Fivetran-centric packaging",
    ],
    bestFor:
      "Analytics engineering teams whose primary job is modeling, testing, and documenting data in the warehouse — with ingestion handled elsewhere.",
    closingNote:
      "Many teams use dbt Cloud (or Core) for transforms and eltPulse for ingest, schedules, catalog, and Git-native pipeline definitions — including dbt project runs inside the same workspace.",
    categories: [
      {
        category: "ELT scope",
        rows: [
          { feature: "Extract & load connectors", eltpulse: true, competitor: false },
          { feature: "dbt project runs", eltpulse: true, competitor: true },
          { feature: "Column lineage from manifest", eltpulse: "Pro+", competitor: true },
          { feature: "Managed docs site", eltpulse: "Catalog", competitor: true },
        ],
      },
      {
        category: "Platform",
        rows: [
          { feature: "Pipeline builder (non-dbt EL)", eltpulse: true, competitor: false },
          { feature: "Customer gateway", eltpulse: "All tiers", competitor: false },
          { feature: "Runs API for all pipeline types", eltpulse: "Pro+", competitor: "dbt jobs API" },
          { feature: "Git export (dlt, Sling, YAML)", eltpulse: "Pro+", competitor: "dbt repo" },
        ],
      },
      {
        category: "Together",
        rows: [
          { feature: "Typical stack pattern", eltpulse: "EL + dbt in one CP", competitor: "T layer + external EL" },
          { feature: "Fivetran + dbt bundle", eltpulse: "Vendor-neutral EL", competitor: "Increasingly bundled" },
        ],
      },
    ],
  },
  {
    slug: "vs-talend",
    name: "Talend",
    tagline: "eltPulse vs. Talend",
    heroSubtitle:
      "Talend is a proven enterprise data integration suite — iPaaS, quality, and governance at global scale. eltPulse is a lighter, Git-native ELT control plane for modern analytics platform teams.",
    description:
      "Talend (Qlik) spans batch and real-time integration, data quality, and API management — with decades of enterprise deployments. Stitch (acquired by Talend) covers simpler SaaS-to-warehouse loading for smaller teams.",
    theyreGoodAt: [
      "Deep enterprise feature set: quality, masking, MDM, and governance",
      "Mature iPaaS and API integration alongside batch pipelines",
      "Global support, compliance narratives, and procurement-friendly packaging",
      "Stitch product line for straightforward managed SaaS ingestion",
    ],
    whereTheyFallShort: [
      "Implementation timelines and TCO often reflect enterprise suite complexity",
      "Git-native, developer-first ELT is not the primary center of gravity",
      "Lean data platform teams may prefer self-serve tiers over sales-led rollouts",
      "BYO compute gateways and air-gapped metadata are not the default story",
    ],
    bestFor:
      "Large enterprises standardizing data integration, quality, and governance across many systems with dedicated integration teams.",
    closingNote:
      "Talend earns its place in Fortune 500 stacks. eltPulse complements that world when analytics engineers want Lakeflow-style EL+T, transparent usage pricing, and artifacts in Git — without a full iPaaS footprint.",
    categories: [
      {
        category: "Enterprise fit",
        rows: [
          { feature: "Data quality & governance suite", eltpulse: "Catalog + contracts", competitor: true },
          { feature: "iPaaS / API integration", eltpulse: "Webhook + API focus", competitor: true },
          { feature: "Global enterprise support", eltpulse: "Team / Enterprise", competitor: true },
          { feature: "Self-serve signup & free tier", eltpulse: true, competitor: "Stitch tier / sales" },
        ],
      },
      {
        category: "Modern analytics ELT",
        rows: [
          { feature: "Git-native pipeline export", eltpulse: "Pro+", competitor: "Limited" },
          { feature: "dbt-first transform workflow", eltpulse: true, competitor: "Varies" },
          { feature: "Customer gateway (BYO compute)", eltpulse: "All tiers", competitor: false },
          { feature: "Open engines (dlt, Sling)", eltpulse: true, competitor: "Talend-native" },
        ],
      },
    ],
  },
  {
    slug: "vs-informatica",
    name: "Informatica",
    tagline: "eltPulse vs. Informatica",
    heroSubtitle:
      "Informatica IDMC sets the bar for enterprise data management — catalog, quality, MDM, and integration in one portfolio. eltPulse focuses narrowly on git-native ELT for analytics platform teams.",
    description:
      "Informatica Intelligent Data Management Cloud (IDMC) is the incumbent choice when CDOs need catalog, lineage, quality, governance, and integration under one vendor with enterprise SLAs.",
    theyreGoodAt: [
      "Comprehensive IDMC portfolio: integration, quality, catalog, MDM, governance",
      "Strong metadata, lineage, and compliance story for regulated industries",
      "Decades of enterprise trust and partner ecosystem",
      "Scalable batch and cloud-native integration patterns",
    ],
    whereTheyFallShort: [
      "Breadth and enterprise packaging can mean long evaluations and heavy ops teams",
      "Analytics engineers seeking Git-first EL+T may find the UX oriented to broader IT",
      "Self-serve experimentation and startup-friendly pricing are not the sweet spot",
      "Customer-owned sync compute and OSS engine portability are secondary",
    ],
    bestFor:
      "Enterprises consolidating data management under a single strategic vendor with governance, MDM, and integration requirements.",
    closingNote:
      "Informatica is often the right answer for enterprise-wide data management programs. eltPulse is the right answer when a platform team wants fast iteration, Git-owned ELT, BYO gateways, and optional self-hosted control plane — alongside tools you already use.",
    categories: [
      {
        category: "Data management breadth",
        rows: [
          { feature: "MDM & enterprise governance", eltpulse: "RBAC + catalog", competitor: true },
          { feature: "Enterprise catalog & lineage", eltpulse: "Pro+ lineage", competitor: true },
          { feature: "Data quality & profiling", eltpulse: "Checks + contracts", competitor: true },
          { feature: "Single-vendor IDMC suite", eltpulse: "ELT-focused CP", competitor: true },
        ],
      },
      {
        category: "Analytics engineering",
        rows: [
          { feature: "Git-native EL artifacts", eltpulse: true, competitor: "Limited" },
          { feature: "dbt project runs in workspace", eltpulse: true, competitor: "Via integration" },
          { feature: "Free tier / self-serve start", eltpulse: true, competitor: "Enterprise-led" },
          { feature: "Air-gapped metadata export", eltpulse: "Team+", competitor: "Enterprise programs" },
        ],
      },
    ],
  },
  {
    slug: "vs-rivery",
    name: "Rivery",
    tagline: "eltPulse vs. Rivery",
    heroSubtitle:
      "Rivery delivers approachable SaaS ELT with reverse ETL and activation built in — a strong all-in-one for teams that want speed without running infrastructure.",
    description:
      "Rivery (now part of the Boomi family) combines managed pipelines, reverse ETL, and data activation in a unified cloud product — popular with lean data teams moving fast on Snowflake, BigQuery, and Redshift.",
    theyreGoodAt: [
      "Fast time-to-value: sources, transforms, and activation in one UI",
      "Reverse ETL and data activation without a separate CDP",
      "Pre-built logic blocks and templates for common patterns",
      "Managed SaaS — no workers or gateways to maintain",
    ],
    whereTheyFallShort: [
      "Pipeline definitions are product-native — Git as source of truth is secondary",
      "Platform teams outgrowing UI-only workflows may want repo-based SDLC",
      "Customer gateway and self-hosted control plane paths are limited",
      "Pricing scales with platform usage — verify fit at high row volumes",
    ],
    bestFor:
      "Growth-stage data teams that want managed EL+activation quickly without assembling Fivetran + Hightouch + orchestration.",
    closingNote:
      "Rivery is a capable managed platform for speed. eltPulse suits teams graduating to Git-native definitions, BYO compute, open sync engines, and an Enterprise self-hosted option — while keeping a product UI for day-to-day work.",
    categories: [
      {
        category: "Product scope",
        rows: [
          { feature: "Managed EL pipelines", eltpulse: true, competitor: true },
          { feature: "Reverse ETL / activation", eltpulse: "Roadmap / partners", competitor: true },
          { feature: "dbt integration", eltpulse: true, competitor: true },
          { feature: "Logic templates & kits", eltpulse: "Scenarios", competitor: true },
        ],
      },
      {
        category: "Platform engineering",
        rows: [
          { feature: "Git artifact export", eltpulse: "Pro+", competitor: false },
          { feature: "Customer gateway", eltpulse: "All tiers", competitor: false },
          { feature: "Runs API & webhooks", eltpulse: "Pro+", competitor: true },
          { feature: "Self-hosted control plane", eltpulse: "Enterprise", competitor: false },
        ],
      },
    ],
  },
  {
    slug: "vs-integrateio",
    name: "Integrate.io",
    tagline: "eltPulse vs. Integrate.io",
    heroSubtitle:
      "Integrate.io (formerly Xplenty) offers low-code ETL/ELT with a broad connector library — excellent for teams prioritizing visual integration over repo workflows.",
    description:
      "Integrate.io targets mid-market teams with drag-and-drop pipelines, API connectivity, and reverse ETL — a practical choice when analysts and integrators outnumber platform engineers.",
    theyreGoodAt: [
      "Low-code pipeline designer with short learning curve",
      "Broad connector set including databases, SaaS, and APIs",
      "Reverse ETL and operational analytics use cases",
      "Transparent mid-market pricing relative to enterprise suites",
    ],
    whereTheyFallShort: [
      "Less emphasis on Git-native definitions and PR-based promotion",
      "Limited customer-owned execution plane (gateways / air-gap)",
      "Platform engineering teams may want exportable dlt/Sling/dbt artifacts",
      "Not positioned as self-hosted Enterprise control plane",
    ],
    bestFor:
      "Mid-market teams wanting visual ETL/ELT and reverse ETL without hiring a dedicated platform engineering function.",
    closingNote:
      "Integrate.io is a sensible choice for low-code integration. eltPulse fits when you are building a data platform practice — Git export, dbt runs, catalog, tier gates, and BYO compute from day one.",
    categories: [
      {
        category: "Usability",
        rows: [
          { feature: "Low-code visual designer", eltpulse: true, competitor: true },
          { feature: "API & REST connectors", eltpulse: true, competitor: true },
          { feature: "Reverse ETL", eltpulse: "Partners", competitor: true },
          { feature: "Analyst-friendly onboarding", eltpulse: "Canvas + docs", competitor: true },
        ],
      },
      {
        category: "Platform depth",
        rows: [
          { feature: "Git-native export (dlt, YAML)", eltpulse: "Pro+", competitor: false },
          { feature: "Column lineage (dbt)", eltpulse: "Pro+", competitor: "Limited" },
          { feature: "Customer gateway tokens", eltpulse: "All tiers", competitor: false },
          { feature: "Enterprise self-hosted CP", eltpulse: "From $24k/yr", competitor: false },
        ],
      },
    ],
  },
  {
    slug: "vs-estuary",
    name: "Estuary",
    tagline: "eltPulse vs. Estuary",
    heroSubtitle:
      "Estuary Flow excels at real-time CDC and streaming ingest with an open, developer-friendly model. eltPulse adds a broader EL+T control plane — batch and near-real-time — with catalog and dbt.",
    description:
      "Estuary (Flow) combines change-data-capture, streaming, and batch in a modern platform built on Gazette — strong for teams that need low-latency replication and open-source flexibility.",
    theyreGoodAt: [
      "Real-time CDC and streaming-first architecture",
      "Open-source components and developer-friendly deployment",
      "Efficient handling of high-churn, near-real-time sources",
      "Clear pricing narrative for streaming vs batch workloads",
    ],
    whereTheyFallShort: [
      "Full analytics control plane (dbt hub, canvas, Git export) is not the core focus",
      "Teams wanting all-in-one batch EL+T+orchestration may layer more tools",
      "Enterprise RBAC, air-gap metadata, and multi-tenant SaaS shell vary by deployment",
      "Less emphasis on managed “sign up and run” for non-engineers",
    ],
    bestFor:
      "Engineering teams prioritizing real-time replication and CDC who value open architecture and streaming performance.",
    closingNote:
      "Estuary is an excellent choice for streaming ingest. eltPulse complements or overlaps depending on need — batch EL, dbt transforms, visual builder, managed SaaS tiers, and Git-native artifacts for the whole pipeline lifecycle.",
    categories: [
      {
        category: "Ingest model",
        rows: [
          { feature: "Real-time CDC / streaming", eltpulse: "Monitors + slices", competitor: true },
          { feature: "Batch EL connectors", eltpulse: true, competitor: true },
          { feature: "Open-source engine", eltpulse: "dlt, Sling", competitor: "Flow / Gazette" },
          { feature: "Low-latency replication", eltpulse: "Gateway-dependent", competitor: true },
        ],
      },
      {
        category: "Downstream platform",
        rows: [
          { feature: "dbt runs & manifest lineage", eltpulse: true, competitor: "Partner / DIY" },
          { feature: "Visual pipeline canvas", eltpulse: true, competitor: "Flow UI" },
          { feature: "Workspace catalog & assets", eltpulse: true, competitor: "Limited" },
          { feature: "Managed multi-tenant SaaS", eltpulse: true, competitor: "Cloud + self-serve" },
        ],
      },
    ],
  },
  {
    slug: "vs-aws-glue",
    name: "AWS Glue",
    tagline: "eltPulse vs. AWS Glue",
    heroSubtitle:
      "AWS Glue is the native serverless ETL/ELT choice inside AWS — deep IAM, Lake Formation, and pay-per-DPU economics. eltPulse adds a vendor-neutral control plane that can run on your gateway or managed workers.",
    description:
      "Glue provides crawlers, Spark jobs, Data Catalog integration, and Studio notebooks for teams all-in on AWS. It is often the default when data already lives in S3, Redshift, and the AWS security perimeter.",
    theyreGoodAt: [
      "Native AWS integration: IAM, VPC, Lake Formation, Redshift, S3",
      "Serverless Spark without managing clusters (DPUs)",
      "Glue Data Catalog as a Hive-compatible metastore",
      "Pay for job runtime — no always-on cluster for batch",
    ],
    whereTheyFallShort: [
      "AWS-centric — multi-cloud and portable Git artifacts are DIY",
      "Developer UX and connector catalog differ from productized ELT SaaS",
      "Orchestration, dbt, and business-user UI often require adjacent services",
      "Cost forecasting requires DPU tuning and job optimization discipline",
    ],
    bestFor:
      "Teams standardized on AWS who want serverless Spark ETL inside the AWS ecosystem with existing cloud engineering skills.",
    closingNote:
      "Glue is a strong AWS primitive. eltPulse runs pipelines on your AWS gateway or managed workers with open engines, Git export, and a product layer for catalog and dbt — portable if you add Azure or GCP later.",
    categories: [
      {
        category: "Cloud fit",
        rows: [
          { feature: "Native AWS IAM & VPC", eltpulse: "Via gateway", competitor: true },
          { feature: "Serverless Spark transforms", eltpulse: "dbt + engines", competitor: true },
          { feature: "Multi-cloud portability", eltpulse: true, competitor: "AWS-first" },
          { feature: "Glue Data Catalog", eltpulse: "Workspace catalog", competitor: true },
        ],
      },
      {
        category: "Product experience",
        rows: [
          { feature: "Connector catalog UI", eltpulse: true, competitor: "Crawlers + custom" },
          { feature: "Git-native pipeline export", eltpulse: "Pro+", competitor: "Scripts in repo" },
          { feature: "Non-engineer pipeline builder", eltpulse: true, competitor: "Glue Studio" },
          { feature: "Runs history & observability SaaS", eltpulse: true, competitor: "CloudWatch" },
        ],
      },
    ],
  },
];

export const COMPETITOR_MAP: Record<string, Competitor> = Object.fromEntries(
  COMPETITORS.map((c) => [c.slug, c])
);
