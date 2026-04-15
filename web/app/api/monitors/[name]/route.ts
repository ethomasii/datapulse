import type { NextRequest } from "next/server";
import { monitorsDELETE, monitorsPATCH } from "@/lib/monitors/api-handlers";

export async function PATCH(request: NextRequest, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return monitorsPATCH(decodeURIComponent(name ?? ""), request);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return monitorsDELETE(decodeURIComponent(name ?? ""));
}
