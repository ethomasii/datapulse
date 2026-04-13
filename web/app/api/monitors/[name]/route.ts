import { monitorsDELETE } from "@/lib/monitors/api-handlers";

export async function DELETE(_request: Request, { params }: { params: Promise<{ name: string }> }) {
  const { name } = await params;
  return monitorsDELETE(decodeURIComponent(name ?? ""));
}
