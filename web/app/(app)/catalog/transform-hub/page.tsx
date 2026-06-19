import type { Metadata } from "next";
import { CatalogTransformHubClient } from "@/components/catalog/catalog-transform-hub-client";

export const metadata: Metadata = {
  title: "Transform hub",
  description: "Browse optional dbt staging packages — warehouse SQL recipes are the default transform path.",
};

export default function CatalogTransformHubPage() {
  return <CatalogTransformHubClient />;
}
