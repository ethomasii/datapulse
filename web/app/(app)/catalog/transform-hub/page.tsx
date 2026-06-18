import type { Metadata } from "next";
import { CatalogTransformHubClient } from "@/components/catalog/catalog-transform-hub-client";

export const metadata: Metadata = {
  title: "Transform hub",
  description: "Browse dbt staging packages and attach transforms to your pipelines.",
};

export default function CatalogTransformHubPage() {
  return <CatalogTransformHubClient />;
}
