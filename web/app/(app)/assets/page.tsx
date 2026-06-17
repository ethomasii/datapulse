import type { Metadata } from "next";
import { AssetsPageClient } from "@/components/assets/assets-page-client";

export const metadata: Metadata = {
  title: "Assets",
  description: "Config-derived inventory of ingested sources, raw tables, and dbt transforms across your workspace.",
};

export default function AssetsPage() {
  return <AssetsPageClient />;
}
