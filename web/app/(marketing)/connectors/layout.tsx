import { CatalogNav } from "@/components/marketing/catalog-nav";

export default function ConnectorsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CatalogNav />
      {children}
    </>
  );
}
