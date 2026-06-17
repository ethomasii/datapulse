import type { MetadataRoute } from "next";
import { getAllMarketingConnectors, getSourceCount } from "@/lib/marketing/connector-catalog";
import { PIPELINE_SCENARIOS } from "@/lib/marketing/pipeline-scenarios";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev";

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();
  const staticPages: MetadataRoute.Sitemap = [
    { url: `${base}/`, changeFrequency: "weekly", priority: 1 },
    { url: `${base}/features`, changeFrequency: "monthly", priority: 0.9 },
    { url: `${base}/connectors`, changeFrequency: "weekly", priority: 0.95 },
    { url: `${base}/scenarios`, changeFrequency: "weekly", priority: 0.9 },
    { url: `${base}/pricing`, changeFrequency: "monthly", priority: 0.8 },
    { url: `${base}/compare`, changeFrequency: "monthly", priority: 0.7 },
    { url: `${base}/docs`, changeFrequency: "weekly", priority: 0.8 },
    { url: `${base}/docs/connectors`, changeFrequency: "weekly", priority: 0.75 },
    { url: `${base}/changelog`, changeFrequency: "weekly", priority: 0.5 },
    { url: `${base}/roadmap`, changeFrequency: "monthly", priority: 0.5 },
  ];

  const connectorPages: MetadataRoute.Sitemap = getAllMarketingConnectors().map((c) => ({
    url: `${base}/connectors/${c.slug}`,
    lastModified: now,
    changeFrequency: "monthly" as const,
    priority: c.trustTier === "verified" ? 0.7 : 0.5,
  }));

  // Scenario pages could be added later; hub is indexed
  void getSourceCount();
  void PIPELINE_SCENARIOS;

  return [...staticPages, ...connectorPages];
}
