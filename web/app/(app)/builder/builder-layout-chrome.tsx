"use client";

import { Suspense, type ReactNode } from "react";
import { useSearchParams } from "next/navigation";
import { BuilderSubnav } from "@/components/pipeline-canvas/builder-subnav";

function BuilderLayoutChromeInner({ children }: { children: ReactNode }) {
  const searchParams = useSearchParams();
  const canvasEmbedded =
    searchParams.get("view") === "canvas" && Boolean(searchParams.get("pipeline")?.trim());

  if (canvasEmbedded) {
    return <div className="w-full min-w-0">{children}</div>;
  }

  return (
    <>
      <div className="-mx-4 border-b border-slate-200 dark:border-slate-800 sm:-mx-6 lg:-mx-8">
        <div className="px-4 sm:px-6 lg:px-8">
          <BuilderSubnav />
        </div>
      </div>
      <div className="mt-6 w-full min-w-0">{children}</div>
    </>
  );
}

export function BuilderLayoutChrome({ children }: { children: ReactNode }) {
  return (
    <Suspense fallback={<div className="w-full min-w-0">{children}</div>}>
      <BuilderLayoutChromeInner>{children}</BuilderLayoutChromeInner>
    </Suspense>
  );
}
