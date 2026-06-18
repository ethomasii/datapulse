import type { Metadata } from "next";
import { Suspense } from "react";
import { CatalogDbtNewClient } from "@/components/catalog/catalog-dbt-new-client";

export const metadata: Metadata = {
  title: "Catalog — new dbt project",
};

export default function CatalogDbtNewPage() {
  return (
    <Suspense fallback={null}>
      <CatalogDbtNewClient />
    </Suspense>
  );
}
