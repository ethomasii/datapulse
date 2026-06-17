import type { Metadata } from "next";

const siteName = "eltPulse";

export function marketingPageMetadata(opts: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}): Metadata {
  const url = opts.path.startsWith("http") ? opts.path : opts.path;
  return {
    title: opts.title,
    description: opts.description,
    keywords: opts.keywords,
    alternates: { canonical: url },
    openGraph: {
      title: `${opts.title} | ${siteName}`,
      description: opts.description,
      url,
      siteName,
      type: "website",
    },
    twitter: {
      card: "summary_large_image",
      title: `${opts.title} | ${siteName}`,
      description: opts.description,
    },
  };
}

export function jsonLdScript(data: Record<string, unknown>) {
  return {
    __html: JSON.stringify(data),
  };
}
