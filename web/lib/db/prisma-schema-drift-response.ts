import { Prisma } from "@prisma/client";
import { NextResponse } from "next/server";

const SCHEMA_DRIFT_MESSAGE =
  "Database schema is behind the app. From the web folder run: npm run db:push (uses DATABASE_URL in .env.local). " +
  "Or run prisma/add-webhook-columns.sql in your Postgres SQL editor.";

/** Map Prisma “column does not exist” to a JSON body the UI can show (P2022). */
export function prismaSchemaDriftResponse(e: unknown): NextResponse | null {
  if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2022") {
    return NextResponse.json({ error: SCHEMA_DRIFT_MESSAGE }, { status: 503 });
  }
  return null;
}
