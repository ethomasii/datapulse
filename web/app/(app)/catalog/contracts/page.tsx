import { Suspense } from "react";
import { Loader2 } from "lucide-react";
import { CatalogContractsClient } from "@/components/catalog/catalog-contracts-client";

export default function CatalogContractsPage() {
  return (
    <Suspense
      fallback={
        <p className="flex items-center gap-2 text-sm text-slate-500">
          <Loader2 className="h-4 w-4 animate-spin" /> Loading contracts…
        </p>
      }
    >
      <CatalogContractsClient />
    </Suspense>
  );
}
