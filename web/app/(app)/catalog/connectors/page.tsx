import type { Metadata } from "next";
import { CatalogConnectorsClient } from "@/components/catalog/catalog-connectors-client";

export const metadata: Metadata = {
  title: "Catalog — Connectors",
};

export default function CatalogConnectorsPage() {
  return <CatalogConnectorsClient />;
}
