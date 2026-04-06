import { NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { getCurrentDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

/** Disconnect GitHub (revoke is manual on GitHub; we delete our copy of the token). */
export async function DELETE() {
  const user = await getCurrentDbUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    await db.githubConnection.deleteMany({ where: { userId: user.id } });
    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2021") {
      return NextResponse.json(
        { error: "Database schema is missing the GithubConnection table. Run npm run db:push from web/." },
        { status: 503 }
      );
    }
    throw e;
  }
}
