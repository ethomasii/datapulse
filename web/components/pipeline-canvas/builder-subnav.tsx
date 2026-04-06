"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

export function BuilderSubnav() {
  const pathname = usePathname();

  const tabs = [
    { href: "/builder", label: "Form builder" },
    { href: "/builder/canvas", label: "Visual canvas" },
  ];

  return (
    <nav className="flex justify-center gap-1" aria-label="Pipeline builder">
      {tabs.map((t) => {
        const active =
          t.href === "/builder" ? pathname === "/builder" : pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            className={clsx(
              "-mb-px inline-flex border-b-2 px-4 py-2.5 text-sm font-medium transition",
              active
                ? "border-sky-600 text-sky-700 dark:border-sky-500 dark:text-sky-300"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
