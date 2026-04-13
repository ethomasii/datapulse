import { Suspense } from "react";
import { BuilderClient } from "./builder-client";

type SearchParamsInput = Record<string, string | string[] | undefined>;

export default async function BuilderPage({
  searchParams,
}: {
  /** Next.js 15 may pass a Promise; older versions pass a plain object. */
  searchParams: SearchParamsInput | Promise<SearchParamsInput>;
}) {
  const sp = await Promise.resolve(searchParams);
  const pipeline = typeof sp.pipeline === "string" ? sp.pipeline : null;
  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading builder…</div>}>
      <BuilderClient initialEditPipelineId={pipeline} />
    </Suspense>
  );
}
