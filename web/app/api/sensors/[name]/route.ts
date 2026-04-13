import { monitorsDELETE } from "@/lib/monitors/api-handlers";

/** @deprecated Use `/api/monitors/[name]` — alias kept for older clients. */
export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return monitorsDELETE(decodeURIComponent(name ?? ""));
}
