import { Suspense } from "react";

export default function RunSlicesLayout({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>{children}</Suspense>;
}
