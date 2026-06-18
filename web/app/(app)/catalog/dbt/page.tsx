import type { Metadata } from "next";
import { CatalogDbtProjectsClient } from "@/components/catalog/catalog-dbt-projects-client";

export const metadata: Metadata = {
  title: "Catalog — dbt projects",
};

export default function CatalogDbtPage() {
  return <CatalogDbtProjectsClient />;
}
