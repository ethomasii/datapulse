import { NextResponse } from "next/server";
import { z } from "zod";
import { getCurrentDbUser } from "@/lib/auth/server";
import { discoverSource } from "@/lib/elt/source-discover";

const inlineSchema = z.object({
  connectionType: z.enum(["source", "destination"]).default("source"),
  connector: z.string().min(1),
  config: z.record(z.string(), z.unknown()).optional().default({}),
  secrets: z.record(z.string(), z.string()).optional(),
  discoverPhase: z.enum(["repos", "resources"]).optional(),
});

/** POST /api/elt/connections/discover — inline discover (quick-start, before save). */
export async function POST(req: Request) {
  const user = await getCurrentDbUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const parsed = inlineSchema.safeParse(await req.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten().fieldErrors }, { status: 400 });
  }

  const result = await discoverSource({
    connectionType: parsed.data.connectionType,
    connector: parsed.data.connector,
    config: parsed.data.config as Record<string, unknown>,
    secrets: parsed.data.secrets,
    discoverPhase: parsed.data.discoverPhase,
  });

  return NextResponse.json(result, { status: result.ok ? 200 : 422 });
}
