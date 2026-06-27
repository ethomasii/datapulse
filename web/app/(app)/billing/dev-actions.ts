"use server";

import { revalidatePath } from "next/cache";
import type { PlanTier } from "@prisma/client";
import { requireDbUser } from "@/lib/auth/server";
import { isSuperAdminClerkId } from "@/lib/auth/super-admin";
import { db } from "@/lib/db/client";

export async function setDevTier(tier: PlanTier): Promise<void> {
  const user = await requireDbUser();

  if (!isSuperAdminClerkId(user.clerkId)) {
    throw new Error("Unauthorized");
  }

  await db.subscription.upsert({
    where: { userId: user.id },
    create: {
      userId: user.id,
      tier,
      status: "active",
    },
    update: {
      tier,
      status: "active",
      stripeSubscriptionId: null,
      stripeCustomerId: null,
    },
  });

  revalidatePath("/account/billing");
  revalidatePath("/settings/admin");
  revalidatePath("/dashboard");
  revalidatePath("/builder");
  revalidatePath("/account/notifications");
}
