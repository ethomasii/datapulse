"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";

const PRODUCT_LINKS = [
  { href: "/connectors", label: "Connectors" },
  { href: "/scenarios", label: "Scenarios" },
  { href: "/dbt", label: "dbt transforms" },
  { href: "/features", label: "Features" },
  { href: "/compare", label: "Compare" },
] as const;

function NavDropdown({
  label,
  links,
  active,
}: {
  label: string;
  links: readonly { href: string; label: string }[];
  active: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex items-center gap-1 hover:text-slate-900 dark:hover:text-white",
          active && "text-slate-900 dark:text-white"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        {label}
        <ChevronDown className={clsx("h-3.5 w-3.5 transition", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute right-0 top-full z-50 mt-2 min-w-[11rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg dark:border-slate-700 dark:bg-slate-900"
        >
          {links.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-3 py-2 text-sm text-slate-700 hover:bg-slate-50 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              {link.label}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function MarketingNavLinks() {
  const pathname = usePathname() ?? "";
  const productActive = PRODUCT_LINKS.some((l) => pathname === l.href || pathname.startsWith(`${l.href}/`));

  const linkClass = "hover:text-slate-900 dark:hover:text-white";
  const activeClass = "text-slate-900 dark:text-white";

  return (
    <>
      <NavDropdown label="Product" links={PRODUCT_LINKS} active={productActive} />
      <Link href="/docs" className={clsx(linkClass, pathname.startsWith("/docs") && activeClass)}>
        Docs
      </Link>
      <Link href="/pricing" className={clsx(linkClass, pathname === "/pricing" && activeClass)}>
        Pricing
      </Link>
      <Link href="/roadmap" className={clsx(linkClass, pathname === "/roadmap" && activeClass)}>
        Roadmap
      </Link>
    </>
  );
}
