"use client";

import { useTransition } from "react";
import { X } from "lucide-react";
import { dismissOnboardingChecklist } from "@/app/(app)/dashboard/actions";

export function DismissOnboardingButton() {
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      disabled={pending}
      onClick={() => startTransition(() => void dismissOnboardingChecklist())}
      className="rounded-lg p-1.5 text-white/70 transition hover:bg-white/20 hover:text-white disabled:opacity-50"
      aria-label="Dismiss checklist"
    >
      <X className="h-4 w-4" />
    </button>
  );
}
