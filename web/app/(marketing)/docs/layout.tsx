import { DocsSidebar } from "@/components/docs/docs-sidebar";

export default function DocsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-6xl px-4 py-10 sm:px-6 lg:flex lg:gap-12 lg:py-14">
      <DocsSidebar />
      <div className="min-w-0 flex-1 lg:max-w-3xl">{children}</div>
    </div>
  );
}
