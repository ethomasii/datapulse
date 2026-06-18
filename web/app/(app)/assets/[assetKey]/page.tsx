import type { Metadata } from "next";
import { AssetDetailClient } from "@/components/assets/asset-detail-client";
import { decodeAssetKeyParam } from "@/lib/elt/asset-path";

type Props = {
  params: { assetKey: string };
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const key = decodeAssetKeyParam(params.assetKey);
  const short = key.split(":").pop() ?? key;
  return {
    title: `${short} · Asset`,
    description: "Workspace asset details, catalog metadata, and lineage.",
  };
}

export default function AssetDetailPage({ params }: Props) {
  return <AssetDetailClient assetKey={decodeAssetKeyParam(params.assetKey)} />;
}
