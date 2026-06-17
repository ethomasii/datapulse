import { auth, currentUser } from "@clerk/nextjs/server";
import { db } from "@/lib/db/client";
import { seedDemoWorkspaceIfEmpty } from "@/lib/onboarding/demo-workspace";
import { acceptPendingInvitesForUser } from "@/lib/organization/invites";
import type { Subscription, User } from "@prisma/client";

export type UserWithSubscription = User & {
  subscription: Subscription | null;
};

export async function requireAuth(): Promise<string> {
  const { userId } = await auth();
  if (!userId) throw new Error("Unauthorized");
  return userId;
}

/**
 * DB user for the current Clerk session. Auto-provisions when the Clerk webhook
 * cannot reach localhost or as a safety net after sign-up.
 */
export async function getCurrentDbUser(): Promise<UserWithSubscription | null> {
  const { userId } = await auth();
  if (!userId) return null;

  const existing = await db.user.findUnique({
    where: { clerkId: userId },
    include: { subscription: true },
  });
  if (existing) return existing;

  const clerkUser = await currentUser();
  if (!clerkUser) return null;

  const email = clerkUser.emailAddresses[0]?.emailAddress ?? "";
  const name = [clerkUser.firstName, clerkUser.lastName].filter(Boolean).join(" ");

  const isNew = !(await db.user.findUnique({ where: { clerkId: userId }, select: { id: true } }));

  const user = await db.user.upsert({
    where: { clerkId: userId },
    create: {
      clerkId: userId,
      email,
      name: name || null,
      imageUrl: clerkUser.imageUrl || null,
      subscription: {
        create: { tier: "free", status: "active" },
      },
    },
    update: {},
    include: { subscription: true },
  });

  if (isNew) {
    await seedDemoWorkspaceIfEmpty(user.id);
    await acceptPendingInvitesForUser(user.id, email);
  }

  return user;
}

export async function requireDbUser(): Promise<UserWithSubscription> {
  const user = await getCurrentDbUser();
  if (!user) throw new Error("User not found. Please sign in again.");
  return user;
}
