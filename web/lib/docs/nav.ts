export type DocNavItem = {
  href: string;
  label: string;
};

export type DocNavSection = {
  title: string;
  items: DocNavItem[];
};

/** Docs IA — single source for sidebar and jump select */
export const DOCS_SECTIONS: DocNavSection[] = [
  {
    title: "Start here",
    items: [
      { href: "/docs", label: "Overview" },
      { href: "/docs/getting-started", label: "Getting started" },
      { href: "/docs/concepts", label: "Concepts" },
    ],
  },
  {
    title: "Product",
    items: [
      { href: "/docs/pipelines", label: "Pipelines & canvas" },
      { href: "/docs/ai-builder", label: "Pulse AI" },
      { href: "/docs/connectors", label: "Connectors" },
      { href: "/connectors", label: "Connector catalog" },
      { href: "/scenarios", label: "Pipeline scenarios" },
      { href: "/docs/run-slices", label: "Run slices" },
      { href: "/docs/dbt", label: "dbt transforms" },
      { href: "/docs/runs", label: "Runs & telemetry" },
      { href: "/docs/orchestration", label: "Orchestration" },
      { href: "/docs/webhooks", label: "Webhooks" },
      { href: "/docs/gateway", label: "Gateway" },
      { href: "/docs/catalog", label: "Catalog & assets" },
      { href: "/docs/integrations", label: "Integrations" },
      { href: "/docs/repositories", label: "Repositories" },
    ],
  },
  {
    title: "Trust",
    items: [{ href: "/docs/security", label: "Security & data" }],
  },
];
