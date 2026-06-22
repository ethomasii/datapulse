"use client";

import { Database } from "lucide-react";
import { useEffect, useState } from "react";
import { getConnectorIconFallbackUrl, getConnectorIconUrl } from "@/lib/marketing/connector-icons";

type Props = {
  slug: string;
  name: string;
  size?: number;
  className?: string;
};

export function ConnectorIcon({ slug, name, size = 24, className = "" }: Props) {
  const primary = getConnectorIconUrl(slug, size);
  const fallback = getConnectorIconFallbackUrl(slug);
  const [src, setSrc] = useState(primary ?? fallback);

  useEffect(() => {
    setSrc(primary ?? fallback);
  }, [slug, primary, fallback]);

  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element -- third-party brand icons via Simple Icons CDN
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        className={`shrink-0 rounded-sm ${className}`}
        loading="lazy"
        decoding="async"
        onError={() => {
          if (fallback && src !== fallback) setSrc(fallback);
        }}
      />
    );
  }
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-md bg-slate-100 dark:bg-slate-800 ${className}`}
      style={{ width: size, height: size }}
      aria-hidden
    >
      <Database className="text-slate-500" style={{ width: size * 0.55, height: size * 0.55 }} />
    </span>
  );
}
