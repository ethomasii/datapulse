import Link from "next/link";
import { Building2, UserCircle } from "lucide-react";
import { UpcomingFeaturePage } from "@/components/app/upcoming-feature-page";

export default function TeamPage() {
  const actions = (
    <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
      <Link
        href="/account/organization"
        className="inline-flex items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800 dark:bg-white dark:text-slate-900 dark:hover:bg-slate-200"
      >
        <Building2 className="h-4 w-4" aria-hidden />
        Organization
      </Link>
      <Link
        href="/account"
        className="inline-flex items-center justify-center gap-2 rounded-lg border border-slate-300 px-4 py-2.5 text-sm font-medium text-slate-800 hover:bg-slate-50 dark:border-slate-600 dark:text-slate-200 dark:hover:bg-slate-800"
      >
        <UserCircle className="h-4 w-4" aria-hidden />
        Account &amp; Settings
      </Link>
    </div>
  );

  return (
    <UpcomingFeaturePage
      eyebrow="Product · Collaboration"
      title="Team"
      summary="Invite colleagues into a shared workspace, separate viewers from editors, and align billing with organization ownership — the same collaboration story we care about on other SaaS products, tuned for pipeline definitions instead of status pages."
      eta="2026 — after core execution and repo flows"
      actions={actions}
      focusAreas={[
        {
          title: "Planned",
          bullets: [
            "Organization workspace with invited users (Clerk Organizations or equivalent).",
            "Roles: at minimum admin vs member; pipeline edit vs read later.",
            "Shared pipeline list with audit of who changed what.",
          ],
        },
        {
          title: "Billing",
          bullets: [
            "Seat or workspace-based plans aligned with Stripe — see Billing under Account & Settings for current tier.",
          ],
        },
      ]}
      expectations={[
        "Use Organization and profile under Account & Settings for early org fields.",
        "Use a single shared login for early pilots if needed.",
        "Keep pipeline naming conventions documented for your team in the meantime.",
      ]}
    />
  );
}
