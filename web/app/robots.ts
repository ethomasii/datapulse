import type { MetadataRoute } from "next";

const base = process.env.NEXT_PUBLIC_APP_URL ?? "https://eltpulse.dev";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/dashboard", "/builder", "/runs", "/connections", "/gateway"],
    },
    sitemap: `${base}/sitemap.xml`,
  };
}
