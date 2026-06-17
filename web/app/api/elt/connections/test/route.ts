import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { testConnection } from "@/lib/elt/test-connection";

/** Test connection credentials before saving (quick start inline forms). */
export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const connectionType = b.connectionType === "destination" ? "destination" : b.connectionType === "source" ? "source" : null;
  const connector = typeof b.connector === "string" ? b.connector.trim() : "";
  if (!connectionType || !connector) {
    return NextResponse.json({ error: "connectionType and connector required" }, { status: 400 });
  }

  const config =
    b.config && typeof b.config === "object" && !Array.isArray(b.config)
      ? (b.config as Record<string, unknown>)
      : {};
  const secrets =
    b.secrets && typeof b.secrets === "object" && !Array.isArray(b.secrets)
      ? (b.secrets as Record<string, string>)
      : {};

  const result = await testConnection({
    connectionType,
    connector,
    config,
    secrets,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
