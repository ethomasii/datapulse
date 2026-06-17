import { CatalogNav } from "@/components/marketing/catalog-nav";

export default function ScenariosLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <CatalogNav />
      {children}
    </>
  );
}
