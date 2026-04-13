import { NextRequest } from "next/server";
import { monitorsCheckPOST } from "@/lib/monitors/api-handlers";

/** @deprecated Use `/api/monitors/check` — alias kept for older clients. */
export async function POST(request: NextRequest) {
  return monitorsCheckPOST(request);
}
