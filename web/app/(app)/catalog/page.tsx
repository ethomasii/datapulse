import type { Metadata } from "next";
import { CatalogHubClient } from "@/components/catalog/catalog-hub-client";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Workspace catalog — assets, connectors, scenarios, and dbt projects.",
};

export default function CatalogPage() {
  return <CatalogHubClient />;
}
