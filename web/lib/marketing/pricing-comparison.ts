export type PricingTierKey = "free" | "pro" | "team" | "enterprise";

export type ComparisonCell = string | boolean;

export type ComparisonRow = {
  label: string;
  free: ComparisonCell;
  pro: ComparisonCell;
  team: ComparisonCell;
  enterprise: ComparisonCell;
};

export type ComparisonSection = {
  title: string;
  rows: ComparisonRow[];
};

export const PRICING_TIER_LABELS: Record<PricingTierKey, string> = {
  free: "Free",
  pro: "Pro",
  team: "Team",
  enterprise: "Enterprise",
};

/**
 * Full feature comparison — values reflect shipped product behavior or explicit Roadmap / sales items.
 * Enterprise is a sales-assisted tier (not a self-serve Stripe plan).
 */
export const PRICING_COMPARISON_SECTIONS: ComparisonSection[] = [
  {
    title: "Pipelines & runs",
    rows: [
      { label: "Saved pipelines", free: "3", pro: "Unlimited", team: "Unlimited", enterprise: "Unlimited" },
      { label: "Managed compute (shared pool)", free: true, pro: true, team: true, enterprise: "Optional" },
      { label: "Dedicated managed compute add-on", free: false, pro: false, team: "Optional", enterprise: "Optional" },
      { label: "Run history & telemetry", free: "14 days", pro: "90 days", team: "1 year", enterprise: "Custom" },
      { label: "Schedules & monitors", free: true, pro: true, team: true, enterprise: true },
      { label: "Run slices & partitions", free: true, pro: true, team: true, enterprise: true },
      { label: "Webhook triggers", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    title: "Sources & destinations",
    rows: [
      { label: "Connector catalog", free: true, pro: true, team: true, enterprise: true },
      { label: "Connection vault (encrypted secrets)", free: true, pro: true, team: true, enterprise: true },
      { label: "dlt & Sling pipelines", free: true, pro: true, team: true, enterprise: true },
      { label: "Declarative pipeline YAML", free: true, pro: true, team: true, enterprise: true },
      { label: "Git-native artifact export", free: false, pro: true, team: true, enterprise: true },
    ],
  },
  {
    title: "Transforms & quality",
    rows: [
      { label: "Visual transform canvas", free: true, pro: true, team: true, enterprise: true },
      { label: "dbt projects & runs", free: true, pro: true, team: true, enterprise: true },
      { label: "Column lineage (dbt manifest)", free: false, pro: true, team: true, enterprise: true },
      { label: "Data quality checks", free: true, pro: true, team: true, enterprise: true },
    ],
  },
  {
    title: "Team & workspace",
    rows: [
      { label: "Workspace members", free: "1", pro: "1", team: "Unlimited", enterprise: "Unlimited" },
      { label: "Role-based access control", free: false, pro: false, team: true, enterprise: true },
      { label: "Org-scoped gateway tokens", free: false, pro: true, team: true, enterprise: true },
      { label: "SSO / SAML", free: false, pro: false, team: "Roadmap", enterprise: "Roadmap" },
      { label: "Priority support", free: false, pro: "Email", team: true, enterprise: true },
    ],
  },
  {
    title: "Execution & compute",
    rows: [
      { label: "eltPulse-managed workers (default)", free: true, pro: true, team: true, enterprise: "Optional" },
      { label: "Customer gateway (VPC)", free: false, pro: true, team: true, enterprise: true },
      { label: "Self-hosted control plane + gateway", free: false, pro: false, team: false, enterprise: "Contact sales" },
      { label: "Air-gapped metadata option", free: false, pro: false, team: false, enterprise: "Roadmap" },
      { label: "Included row volume / month", free: "Trial", pro: "Included", team: "Custom", enterprise: "Custom" },
      { label: "Metered rows & egress beyond included", free: false, pro: true, team: true, enterprise: "Contract" },
    ],
  },
  {
    title: "Developers",
    rows: [
      { label: "Workspace API keys", free: "1", pro: "5", team: "Unlimited", enterprise: "Unlimited" },
      { label: "Incoming webhook token", free: false, pro: true, team: true, enterprise: true },
      { label: "Runs API & observability API", free: false, pro: true, team: true, enterprise: true },
      { label: "14-day free trial (Pro & Team)", free: false, pro: true, team: true, enterprise: false },
    ],
  },
];

export const PRICING_FAQ = [
  {
    q: "Can I change plans later?",
    a: "Yes. Upgrade or downgrade anytime. Upgrades take effect immediately. Downgrades apply at the end of your billing period.",
  },
  {
    q: "What happens when I hit my pipeline limit on Free?",
    a: "You'll see a prompt to upgrade. Existing pipelines keep running — you can't create new ones until you upgrade or remove some.",
  },
  {
    q: "Is there an annual discount?",
    a: "Yes — annual billing saves you 2 months compared to monthly (pay for 10 months, get 12).",
  },
  {
    q: "How does usage-based pricing work?",
    a: "Pro and Team include a baseline row volume each month. Beyond that, you pay per row and egress. Managed compute is cost-plus with a 15% markup on infrastructure.",
  },
  {
    q: "What is dedicated managed compute?",
    a: "A paid Team add-on for an isolated eltPulse-managed worker queue — no noisy neighbors from other orgs. Still fully managed; not the same as running your own gateway.",
  },
  {
    q: "What is Enterprise vs Team?",
    a: "Enterprise is a sales-assisted deployment — self-hosted control plane and gateway, custom SLAs, and contract pricing. Team is self-serve on Stripe with shared SaaS hosting.",
  },
  {
    q: "What payment methods do you accept?",
    a: "All major credit and debit cards via Stripe. Invoicing available for annual Team and Enterprise plans.",
  },
  {
    q: "What is the free trial?",
    a: "Pro and Team include a 14-day free trial when you upgrade from Billing. No credit card required to start on the Free plan.",
  },
  {
    q: "Can I run pipelines on my own infrastructure?",
    a: "Yes. Use a customer gateway in your VPC on Pro+, or talk to us about a fully self-hosted Enterprise deployment. Your data never has to leave your network.",
  },
];
