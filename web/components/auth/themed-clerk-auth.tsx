"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { clerkEmbeddedAppearance } from "@/lib/clerk/appearance";
import { isClerkConfigured } from "@/lib/clerk/is-configured";

function ClerkNotConfigured() {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50 px-5 py-4 text-sm text-amber-950 dark:border-amber-900 dark:bg-amber-950/40 dark:text-amber-100">
      <p className="font-semibold">Clerk is not configured</p>
      <p className="mt-2">
        Add your API keys to <code className="rounded bg-white/80 px-1 dark:bg-black/30">.env.local</code>, then restart
        the dev server.
      </p>
      <Link href="/dev-setup" className="mt-3 inline-block font-semibold text-sky-600 hover:underline dark:text-sky-400">
        Open local setup guide →
      </Link>
    </div>
  );
}

export function ThemedSignIn() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  if (!isClerkConfigured()) return <ClerkNotConfigured />;
  return <SignIn appearance={clerkEmbeddedAppearance(dark)} signUpUrl="/sign-up" />;
}

export function ThemedSignUp() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  if (!isClerkConfigured()) return <ClerkNotConfigured />;
  return <SignUp appearance={clerkEmbeddedAppearance(dark)} signInUrl="/sign-in" />;
}
