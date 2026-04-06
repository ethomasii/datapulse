import { NextResponse } from "next/server";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export async function GET() {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  try {
    const connections = await db.connection.findMany({
      where: { userId: user.id },
      orderBy: { updatedAt: "desc" },
      select: {
        id: true,
        name: true,
        connectionType: true,
        connector: true,
        config: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    return NextResponse.json({ connections });
  } catch (err: unknown) {
    // Table may not exist yet if migration hasn't run
    const msg = err instanceof Error ? err.message : String(err);
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      return NextResponse.json({ connections: [], _migrationPending: true });
    }
    throw err;
  }
}

export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { name, connectionType, connector, config } = body as Record<string, unknown>;
  if (
    typeof name !== "string" || !name.trim() ||
    typeof connectionType !== "string" || !["source", "destination"].includes(connectionType) ||
    typeof connector !== "string" || !connector.trim()
  ) {
    return NextResponse.json({ error: "name, connectionType (source|destination), and connector are required" }, { status: 400 });
  }

  try {
    const connection = await db.connection.create({
      data: {
        userId: user.id,
        name: name.trim(),
        connectionType,
        connector: connector.trim(),
        config: (config && typeof config === "object" && !Array.isArray(config) ? config : {}) as Record<string, unknown>,
      },
    });
    return NextResponse.json({ connection }, { status: 201 });
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : String(err);
    if (err && typeof err === "object" && "code" in err && (err as { code: string }).code === "P2002") {
      return NextResponse.json({ error: "A connection with that name already exists" }, { status: 409 });
    }
    if (msg.includes("does not exist") || msg.includes("relation") || msg.includes("P2021")) {
      return NextResponse.json({ error: "Database migration pending — run the add-connections.sql migration first" }, { status: 503 });
    }
    throw err;
  }
}
