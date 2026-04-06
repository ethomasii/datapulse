import type { Metadata } from "next";
import { BuilderSubnav } from "@/components/pipeline-canvas/builder-subnav";

export const metadata: Metadata = {
  title: "Pipelines",
};

export default function BuilderLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="w-full min-w-0">
      {/*
        Bleed tab bar to main edges: cancel main horizontal padding, then re-inset tab row.
        Must match app-shell <main> px: px-4 sm:px-6 lg:px-8
      */}
      <div className="-mx-4 border-b border-slate-200 dark:border-slate-800 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <BuilderSubnav />
        </div>
      </div>
      <div className="mt-6 w-full min-w-0">{children}</div>
    </div>
  );
}
