import { NextRequest } from "next/server";
import { monitorsCheckPOST } from "@/lib/monitors/api-handlers";

export async function POST(request: NextRequest) {
  return monitorsCheckPOST(request);
}
