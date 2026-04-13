import { NextRequest } from "next/server";
import { monitorsGET, monitorsPOST } from "@/lib/monitors/api-handlers";

export async function GET() {
  return monitorsGET();
}

export async function POST(request: NextRequest) {
  return monitorsPOST(request);
}
