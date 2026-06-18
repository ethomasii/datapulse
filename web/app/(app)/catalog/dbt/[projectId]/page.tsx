import type { Metadata } from "next";
import { CatalogDbtProjectDetailClient } from "@/components/catalog/catalog-dbt-project-detail-client";

export const metadata: Metadata = {
  title: "Catalog — dbt project",
};

type Props = { params: Promise<{ projectId: string }> };

export default async function CatalogDbtProjectPage({ params }: Props) {
  const { projectId } = await params;
  return <CatalogDbtProjectDetailClient projectId={projectId} />;
}
