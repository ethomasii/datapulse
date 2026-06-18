import type { Metadata } from "next";
import { CatalogScenariosClient } from "@/components/catalog/catalog-scenarios-client";

export const metadata: Metadata = {
  title: "Catalog — Scenarios",
};

export default function CatalogScenariosPage() {
  return <CatalogScenariosClient />;
}
