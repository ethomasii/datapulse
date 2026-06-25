import type { Metadata } from "next";
import { CatalogHubClient } from "@/components/catalog/catalog-hub-client";

export const metadata: Metadata = {
  title: "Library",
  description: "Scenarios, transform recipes, dbt, connectors, data products, and contracts.",
};

export default function CatalogPage() {
  return <CatalogHubClient />;
}
