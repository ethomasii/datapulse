import { NextResponse } from "next/server";
import { headers } from "next/headers";
import { Webhook } from "svix";
import { db } from "@/lib/db/client";
import { seedDemoWorkspaceIfEmpty } from "@/lib/onboarding/demo-workspace";
import { acceptPendingInvitesForUser } from "@/lib/organization/invites";
import { emitSecurityNewDevice } from "@/lib/notifications/emit";
import { recordWorkspaceAuditForUser } from "@/lib/audit/workspace-audit";

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

interface ClerkSessionEvent {
  data: {
    id: string;
    user_id: string;
    client_id?: string;
  };
  type: string;
}

const MAX_KNOWN_CLIENTS = 50;

function parseKnownClientIds(raw: unknown): string[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((v): v is string => typeof v === "string" && v.length > 0);
}

async function handleSessionCreated(data: ClerkSessionEvent["data"]): Promise<void> {
  const clientId = data.client_id?.trim();
  if (!clientId) return;

  const user = await db.user.findUnique({
    where: { clerkId: data.user_id },
    select: { id: true, email: true, knownSignInClientIds: true },
  });
  if (!user) return;

  const known = parseKnownClientIds(user.knownSignInClientIds);
  if (known.includes(clientId)) return;

  const updated = [...known, clientId].slice(-MAX_KNOWN_CLIENTS);
  await db.user.update({
    where: { id: user.id },
    data: { knownSignInClientIds: updated },
  });

  const details = `New sign-in from an unrecognized device or browser (client ${clientId.slice(0, 8)}…). If this wasn't you, secure your account immediately.`;
  await emitSecurityNewDevice(user.id, details, clientId);
  await recordWorkspaceAuditForUser({
    userId: user.id,
    action: "security.new_device_sign_in",
    detail: { clientId, sessionId: data.id },
  });
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

  let event: ClerkUserEvent | ClerkSessionEvent;
  try {
    event = wh.verify(body, {
      "svix-id": svixId,
      "svix-timestamp": svixTimestamp,
      "svix-signature": svixSignature,
    }) as ClerkUserEvent | ClerkSessionEvent;
  } catch {
    return NextResponse.json({ error: "Invalid signature" }, { status: 400 });
  }

  const { type, data } = event;

  if (type === "session.created") {
    await handleSessionCreated((data as ClerkSessionEvent["data"]));
    return NextResponse.json({ received: true });
  }

  if (type === "user.created" || type === "user.updated") {
    const userData = data as ClerkUserEvent["data"];
    const email = userData.email_addresses[0]?.email_address ?? "";
    const name = [userData.first_name, userData.last_name].filter(Boolean).join(" ");

    await db.user.upsert({
      where: { clerkId: userData.id },
      create: {
        clerkId: userData.id,
        email,
        name: name || null,
        imageUrl: userData.image_url ?? null,
        subscription: {
          create: { tier: "free", status: "active" },
        },
      },
      update: {
        email,
        name: name || null,
        imageUrl: userData.image_url ?? null,
      },
    });

    if (type === "user.created") {
      const user = await db.user.findUnique({
        where: { clerkId: userData.id },
        select: { id: true, email: true },
      });
      if (user) {
        await seedDemoWorkspaceIfEmpty(user.id);
        await acceptPendingInvitesForUser(user.id, user.email);
      }
    }
  }

  if (type === "user.deleted") {
    const userData = data as ClerkUserEvent["data"];
    await db.user.deleteMany({ where: { clerkId: userData.id } });
  }

  return NextResponse.json({ received: true });
}
