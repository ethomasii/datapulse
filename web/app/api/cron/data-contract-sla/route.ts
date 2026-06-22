import { NextResponse } from "next/server";
import { unstable_noStore as noStore } from "next/cache";
import { evaluateDataContractSlaAndExpiry } from "@/lib/elt/evaluate-data-contract-sla";

export const dynamic = "force-dynamic";
export const fetchCache = "force-no-store";
export const maxDuration = 60;

/** Vercel Cron — data contract SLA + expiry reminders. Auth: Bearer CRON_SECRET. */
export async function GET(request: Request) {
  noStore();
  const authHeader = request.headers.get("authorization");
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await evaluateDataContractSlaAndExpiry();
    return NextResponse.json({ ok: true, ...result });
  } catch (err) {
    console.error("[cron/data-contract-sla]", err);
    return NextResponse.json({ error: "Data contract SLA cron failed" }, { status: 500 });
  }
}
