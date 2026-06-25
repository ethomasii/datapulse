import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Pipelines",
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return <div className="w-full min-w-0">{children}</div>;
}
