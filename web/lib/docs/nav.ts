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
    ],
  },
  {
    title: "Product",
    items: [
      { href: "/docs/pipelines", label: "Pipelines" },
      { href: "/docs/orchestration", label: "Orchestration" },
      { href: "/docs/integrations", label: "Integrations" },
      { href: "/docs/repositories", label: "Repositories" },
    ],
  },
  {
    title: "Trust",
    items: [{ href: "/docs/security", label: "Security & data" }],
  },
];
