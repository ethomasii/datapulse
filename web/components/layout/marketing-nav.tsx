"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Activity, ChevronDown, Github, Menu, X } from "lucide-react";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { useEffect, useRef, useState } from "react";
import clsx from "clsx";
import { ThemeToggle } from "@/components/layout/theme-toggle";
import { isClerkConfigured } from "@/lib/clerk/is-configured";
import { ELTPULSE_GITHUB_URL } from "@/lib/marketing/github-repo";
import { COMPETITORS } from "@/lib/marketing/competitors";

function CompareDropdown({ linkClass }: { linkClass: string }) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const pathname = usePathname() ?? "";
  const active = pathname === "/compare" || pathname.startsWith("/compare/");

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={clsx(
          "inline-flex items-center gap-1",
          linkClass,
          active && "text-slate-900 dark:text-white"
        )}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        Compare
        <ChevronDown className={clsx("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
      </button>
      {open ? (
        <div
          role="menu"
          className="absolute left-0 top-full z-50 mt-2 w-56 rounded-xl border border-slate-200 bg-white py-2 shadow-xl dark:border-slate-800 dark:bg-slate-900"
        >
          <Link
            href="/compare"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="block px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-300 dark:hover:bg-slate-800 dark:hover:text-white"
          >
            All comparisons →
          </Link>
          <div className="my-1 border-t border-slate-200 dark:border-slate-800" />
          {COMPETITORS.map((c) => (
            <Link
              key={c.slug}
              href={`/compare/${c.slug}`}
              role="menuitem"
              onClick={() => setOpen(false)}
              className="block px-4 py-2 text-sm text-slate-600 hover:bg-slate-100 hover:text-slate-900 dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
            >
              vs. {c.name}
            </Link>
          ))}
        </div>
      ) : null}
    </div>
  );
}

function NavLink({
  href,
  children,
  linkClass,
  active,
  onNavigate,
}: {
  href: string;
  children: React.ReactNode;
  linkClass: string;
  active: boolean;
  onNavigate?: () => void;
}) {
  return (
    <Link href={href} onClick={onNavigate} className={clsx(linkClass, active && "text-slate-900 dark:text-white")}>
      {children}
    </Link>
  );
}

export function MarketingNavLinks({ mobile = false, onNavigate }: { mobile?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname() ?? "";

  const linkClass = mobile
    ? "text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
    : "hover:text-slate-900 dark:hover:text-white";

  const isActive = (href: string, prefix = false) => {
    if (href === "/compare") return pathname === "/compare" || pathname.startsWith("/compare/");
    if (prefix) return pathname === href || pathname.startsWith(`${href}/`);
    return pathname === href;
  };

  if (mobile) {
    return (
      <>
        <NavLink href="/features" linkClass={linkClass} active={isActive("/features")} onNavigate={onNavigate}>
          Features
        </NavLink>
        <NavLink href="/docs" linkClass={linkClass} active={isActive("/docs", true)} onNavigate={onNavigate}>
          Docs
        </NavLink>
        <NavLink href="/compare" linkClass={`${linkClass} font-medium`} active={isActive("/compare")} onNavigate={onNavigate}>
          Compare
        </NavLink>
        {COMPETITORS.map((c) => (
          <Link
            key={c.slug}
            href={`/compare/${c.slug}`}
            onClick={onNavigate}
            className="pl-4 text-sm text-slate-500 dark:text-slate-500"
          >
            vs. {c.name}
          </Link>
        ))}
        <NavLink href="/changelog" linkClass={linkClass} active={isActive("/changelog")} onNavigate={onNavigate}>
          Changelog
        </NavLink>
        <NavLink
          href="/security"
          linkClass={linkClass}
          active={isActive("/security") || isActive("/docs/security")}
          onNavigate={onNavigate}
        >
          Security
        </NavLink>
        <NavLink href="/pricing" linkClass={linkClass} active={isActive("/pricing")} onNavigate={onNavigate}>
          Pricing
        </NavLink>
        <a
          href={ELTPULSE_GITHUB_URL}
          target="_blank"
          rel="noopener noreferrer"
          onClick={onNavigate}
          className={`inline-flex items-center gap-2 ${linkClass}`}
        >
          <Github className="h-4 w-4" />
          GitHub
        </a>
      </>
    );
  }

  return (
    <>
      <NavLink href="/features" linkClass={linkClass} active={isActive("/features")}>
        Features
      </NavLink>
      <NavLink href="/docs" linkClass={linkClass} active={isActive("/docs", true)}>
        Docs
      </NavLink>
      <CompareDropdown linkClass={linkClass} />
      <NavLink href="/changelog" linkClass={linkClass} active={isActive("/changelog")}>
        Changelog
      </NavLink>
      <NavLink
        href="/security"
        linkClass={linkClass}
        active={isActive("/security") || isActive("/docs/security")}
      >
        Security
      </NavLink>
      <NavLink href="/pricing" linkClass={linkClass} active={isActive("/pricing")}>
        Pricing
      </NavLink>
      <a
        href={ELTPULSE_GITHUB_URL}
        target="_blank"
        rel="noopener noreferrer"
        className={`inline-flex items-center gap-1.5 ${linkClass}`}
        title="Open source on GitHub"
      >
        <Github className="h-4 w-4" />
        <span className="hidden lg:inline">GitHub</span>
      </a>
    </>
  );
}

export function MarketingHeader() {
  const [menuOpen, setMenuOpen] = useState(false);
  const clerkReady = isClerkConfigured();

  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 pt-[env(safe-area-inset-top,0px)] backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link
          href="/"
          className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100"
        >
          <Activity className="h-6 w-6 text-sky-600" aria-hidden />
          eltPulse
        </Link>

        {/* Desktop */}
        <div className="hidden items-center gap-3 md:flex">
          <nav className="flex items-center gap-x-3 text-sm font-medium text-slate-600 dark:text-slate-300 sm:gap-x-5 lg:gap-6">
            <MarketingNavLinks />
          </nav>
          <ThemeToggle />
          {clerkReady ? (
            <>
              <SignedOut>
                <Link
                  href="/sign-in"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                >
                  Sign in
                </Link>
                <Link
                  href="/sign-up"
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
                >
                  Start free
                </Link>
              </SignedOut>
              <SignedIn>
                <Link
                  href="/dashboard"
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
                >
                  Dashboard
                </Link>
                <UserButton afterSignOutUrl="/" />
              </SignedIn>
            </>
          ) : (
            <>
              <Link
                href="/dev-setup"
                className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
              >
                Local setup
              </Link>
              <Link
                href="/dev-setup"
                className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
              >
                Configure env
              </Link>
            </>
          )}
        </div>

        {/* Mobile toggle */}
        <div className="flex items-center gap-2 md:hidden">
          <ThemeToggle />
          <button
            type="button"
            className="text-slate-600 dark:text-slate-400"
            onClick={() => setMenuOpen((v) => !v)}
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
          >
            {menuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      {menuOpen ? (
        <div className="border-t border-slate-200 bg-white px-6 py-4 dark:border-slate-800 dark:bg-slate-950 md:hidden">
          <nav className="flex flex-col gap-4">
            <MarketingNavLinks mobile onNavigate={closeMenu} />
            {clerkReady ? (
              <>
                <SignedOut>
                  <Link
                    href="/sign-in"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    onClick={closeMenu}
                  >
                    Sign in
                  </Link>
                  <Link
                    href="/sign-up"
                    className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
                    onClick={closeMenu}
                  >
                    Start free
                  </Link>
                </SignedOut>
                <SignedIn>
                  <Link
                    href="/dashboard"
                    className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                    onClick={closeMenu}
                  >
                    Dashboard
                  </Link>
                  <UserButton afterSignOutUrl="/" />
                </SignedIn>
              </>
            ) : (
              <>
                <Link
                  href="/dev-setup"
                  className="text-sm font-medium text-slate-600 hover:text-slate-900 dark:text-slate-300 dark:hover:text-white"
                  onClick={closeMenu}
                >
                  Local setup
                </Link>
                <Link
                  href="/dev-setup"
                  className="rounded-lg bg-sky-600 px-3.5 py-1.5 text-center text-sm font-semibold text-white shadow-sm hover:bg-sky-500"
                  onClick={closeMenu}
                >
                  Configure env
                </Link>
              </>
            )}
          </nav>
        </div>
      ) : null}
    </header>
  );
}
