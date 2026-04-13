import { NextRequest } from "next/server";
import { monitorsGET, monitorsPOST } from "@/lib/monitors/api-handlers";

/** @deprecated Use `/api/monitors` — alias kept for older clients. */
export async function GET() {
  return monitorsGET();
}

/** @deprecated Use `/api/monitors` — alias kept for older clients. */
export async function POST(request: NextRequest) {
  return monitorsPOST(request);
}
