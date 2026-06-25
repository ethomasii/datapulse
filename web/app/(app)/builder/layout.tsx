import type { Metadata } from "next";
import { BuilderLayoutChrome } from "./builder-layout-chrome";

export const metadata: Metadata = {
  title: "Pipelines",
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      <BuilderLayoutChrome>{children}</BuilderLayoutChrome>
    </div>
  );
}
