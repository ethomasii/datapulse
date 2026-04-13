"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export const ACCOUNT_SETTINGS_TABS = [
  { href: "/account", label: "Profile", match: "exact" as const },
  { href: "/gateway", label: "Gateway", match: "prefix" as const },
  { href: "/account/billing", label: "Billing", match: "prefix" as const },
  { href: "/account/notifications", label: "Notifications", match: "prefix" as const },
  { href: "/account/notification-history", label: "Notification history", match: "prefix" as const },
  { href: "/account/developers", label: "Developers", match: "prefix" as const },
  { href: "/account/organization", label: "Organization", match: "prefix" as const },
  { href: "/account/audit-log", label: "Audit log", match: "prefix" as const },
] as const;

function tabActive(pathname: string, href: string, match: "exact" | "prefix"): boolean {
  if (match === "exact") return pathname === href;
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AccountSettingsNav() {
  const pathname = usePathname();

  return (
    <div className="border-b border-slate-200 dark:border-slate-800">
      <nav className="-mb-px flex gap-1 overflow-x-auto pb-px" aria-label="Account and settings">
        {ACCOUNT_SETTINGS_TABS.map((tab) => {
          const active = tabActive(pathname, tab.href, tab.match);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              className={clsx(
                "whitespace-nowrap rounded-t-lg border border-b-0 px-3 py-2.5 text-sm font-medium transition",
                active
                  ? "border-slate-200 bg-white text-sky-800 dark:border-slate-700 dark:bg-slate-900 dark:text-sky-200"
                  : "border-transparent text-slate-600 hover:border-slate-200 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-700 dark:hover:bg-slate-800/50 dark:hover:text-white"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
