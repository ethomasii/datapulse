"use server";

import { revalidatePath } from "next/cache";
import { requireDbUser } from "@/lib/auth/server";
import { db } from "@/lib/db/client";

export async function dismissOnboardingChecklist() {
  const user = await requireDbUser();
  await db.user.update({
    where: { id: user.id },
    data: { onboardingDismissedAt: new Date() },
  });
  revalidatePath("/dashboard");
}
