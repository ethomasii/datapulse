"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Activity } from "lucide-react";
import { ThemeToggle } from "@/components/layout/theme-toggle";

export function MarketingHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
        <Link href="/" className="flex shrink-0 items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Activity className="h-6 w-6 text-sky-600" aria-hidden />
          eltPulse
        </Link>
        <nav className="flex flex-wrap items-center justify-end gap-x-3 gap-y-2 text-sm font-medium text-slate-600 dark:text-slate-300 sm:gap-x-6">
          <Link href="/docs" className="hover:text-slate-900 dark:hover:text-white">
            Docs
          </Link>
          <Link href="/roadmap" className="hover:text-slate-900 dark:hover:text-white">
            Roadmap
          </Link>
          <Link href="/changelog" className="hidden hover:text-slate-900 sm:inline dark:hover:text-white">
            Changelog
          </Link>
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Pricing
          </Link>
          <Link href="/compare" className="hover:text-slate-900 dark:hover:text-white">
            Compare
          </Link>
          <ThemeToggle />
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-500"
            >
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 sm:gap-x-4">
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
