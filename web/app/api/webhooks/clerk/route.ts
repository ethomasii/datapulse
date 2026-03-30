import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db/client";

interface ClerkUserEvent {
  data: {
    id: string;
    email_addresses: Array<{ email_address: string; id: string }>;
    first_name?: string;
    last_name?: string;
    image_url?: string;
  };
  type: string;
}

export async function POST(request: Request) {
  const secret = process.env.CLERK_WEBHOOK_SECRET;
  if (!secret) {
    return NextResponse.json(
      { error: "Webhook secret not configured" },
      { status: 500 }
    );
  }

  const headerPayload = await headers();
  const svixId = headerPayload.get("svix-id");
  const svixTimestamp = headerPayload.get("svix-timestamp");
  const svixSignature = headerPayload.get("svix-signature");

  if (!svixId || !svixTimestamp || !svixSignature) {
    return NextResponse.json({ error: "Missing svix headers" }, { status: 400 });
  }

  const body = await request.text();
  const wh = new Webhook(secret);

  let event: ClerkUserEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  if (type === "user.created" || type === "user.updated") {
    const email = data.email_addresses[0]?.email_address ?? "";
    const name = [data.first_name, data.last_name].filter(Boolean).join(" ");

    await db.user.upsert({
      where: { clerkId: data.id },
      create: {
        clerkId: data.id,
        email,
        name: name || null,
        imageUrl: data.image_url ?? null,
        subscription: {
          create: { tier: "free", status: "active" },
        },
      },
      update: {
        email,
        name: name || null,
        imageUrl: data.image_url ?? null,
      },
    });
  }

  if (type === "user.deleted") {
    await db.user.deleteMany({ where: { clerkId: data.id } });
  }

  return NextResponse.json({ received: true });
}
