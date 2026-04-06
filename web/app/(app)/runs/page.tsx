import { Suspense } from "react";
import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";
import { RunsClient } from "./runs-client";

export default async function RunsPage() {
  const user = await requireDbUser();
  const pipelines = await db.eltPipeline.findMany({
    where: { userId: user.id },
    select: { id: true, name: true },
    orderBy: { name: "asc" },
  });

  return (
    <Suspense fallback={<div className="p-6 text-slate-500">Loading…</div>}>
      <RunsClient initialPipelines={pipelines} />
    </Suspense>
  );
}
