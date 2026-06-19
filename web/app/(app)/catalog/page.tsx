import type { Metadata } from "next";
import { CatalogHubClient } from "@/components/catalog/catalog-hub-client";

export const metadata: Metadata = {
  title: "Catalog",
  description: "Workspace catalog — assets, lake transforms, connectors, and optional git SQL projects.",
};

export default function CatalogPage() {
  return <CatalogHubClient />;
}
