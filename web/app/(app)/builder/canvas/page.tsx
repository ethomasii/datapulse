import type { Metadata } from "next";
import { Suspense } from "react";
import { CanvasPageClient } from "./canvas-page-client";

export const metadata: Metadata = {
  title: "Visual canvas",
};

export default function BuilderCanvasPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-[420px] items-center justify-center text-sm text-slate-500">Loading canvas…</div>
      }
    >
      <CanvasPageClient />
    </Suspense>
  );
}
