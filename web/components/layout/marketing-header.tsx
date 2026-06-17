"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Activity } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function MarketingHeader() {
  return (
    <header className="sticky top-0 z-50 border-b border-slate-200 bg-white/90 backdrop-blur dark:border-slate-800 dark:bg-slate-950/90">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Activity className="h-6 w-6 text-sky-600" aria-hidden />
          eltPulse
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm font-medium text-slate-600 dark:text-slate-300 sm:gap-x-5">
          <Link href="/docs" className="hidden hover:text-slate-900 sm:inline dark:hover:text-white">
            Docs
          </Link>
          <Link href="/roadmap" className="hover:text-slate-900 dark:hover:text-white">
            Roadmap
          </Link>
          <Link href="/changelog" className="hidden hover:text-slate-900 md:inline dark:hover:text-white">
            Changelog
          </Link>
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/compare" className="hidden hover:text-slate-900 lg:inline dark:hover:text-white">
            Compare
          </Link>
          <ThemeToggle />
          <SignedOut>
            <Link
              href="/sign-in"
              className="hidden hover:text-slate-900 sm:inline dark:hover:text-white"
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
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
              <Link
                href="/quick-start"
                className="hidden rounded-lg border border-sky-200 bg-sky-50 px-2.5 py-1 text-xs font-semibold text-sky-800 hover:bg-sky-100 dark:border-sky-800 dark:bg-sky-950 dark:text-sky-200 sm:inline"
              >
                Quick start
              </Link>
              <Link href="/dashboard" className="hover:text-slate-900 dark:hover:text-white">
                Dashboard
              </Link>
              <UserButton afterSignOutUrl="/" />
            </div>
          </SignedIn>
        </nav>
      </div>
    </header>
  );
}
