import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { Activity } from "lucide-react";

export function MarketingHeader() {
  return (
    <header className="border-b border-slate-200 bg-white/80 backdrop-blur dark:border-slate-800 dark:bg-slate-950/80">
      <div className="mx-auto flex h-14 max-w-6xl items-center justify-between px-4 sm:px-6">
        <Link href="/" className="flex items-center gap-2 font-semibold text-slate-900 dark:text-slate-100">
          <Activity className="h-6 w-6 text-sky-600" aria-hidden />
          DataPulse
        </Link>
        <nav className="flex items-center gap-6 text-sm font-medium text-slate-600 dark:text-slate-300">
          <Link href="/pricing" className="hover:text-slate-900 dark:hover:text-white">
            Pricing
          </Link>
          <SignedOut>
            <Link
              href="/sign-in"
              className="rounded-lg bg-sky-600 px-3 py-1.5 text-white hover:bg-sky-500"
            >
              Sign in
            </Link>
          </SignedOut>
          <SignedIn>
            <div className="flex items-center gap-4">
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
