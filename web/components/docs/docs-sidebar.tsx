"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import clsx from "clsx";
import { DOCS_SECTIONS } from "@/lib/docs/nav";

export function DocsSidebar() {
  const pathname = usePathname();
  const router = useRouter();
  const flat = DOCS_SECTIONS.flatMap((s) => s.items);

  return (
    <>
      {/* Mobile: jump selector */}
      <div className="mb-8 lg:hidden">
        <label htmlFor="docs-jump" className="sr-only">
          Jump to documentation page
        </label>
        <select
          id="docs-jump"
          className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm dark:border-slate-600 dark:bg-slate-900"
          value={pathname}
          onChange={(e) => router.push(e.target.value)}
        >
          {flat.map((item) => (
            <option key={item.href} value={item.href}>
              {item.label}
            </option>
          ))}
        </select>
      </div>

      <aside className="hidden w-52 shrink-0 lg:block">
        <nav
          className="sticky top-24 space-y-8 border-b border-slate-200 pb-8 lg:border-b-0 lg:pb-0 dark:border-slate-800"
          aria-label="Documentation"
        >
          {DOCS_SECTIONS.map((section) => (
            <div key={section.title}>
              <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">
                {section.title}
              </p>
              <ul className="space-y-0.5">
                {section.items.map((item) => {
                  const active = pathname === item.href;
                  return (
                    <li key={item.href}>
                      <Link
                        href={item.href}
                        className={clsx(
                          "block rounded-lg px-2 py-1.5 text-sm transition",
                          active
                            ? "bg-sky-50 font-medium text-sky-900 dark:bg-sky-950/50 dark:text-sky-100"
                            : "text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
                        )}
                      >
                        {item.label}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </nav>
      </aside>
    </>
  );
}
