"use client";

import { useEffect, useState } from "react";
import { SignIn, SignUp } from "@clerk/nextjs";
import { useTheme } from "next-themes";
import { clerkEmbeddedAppearance } from "@/lib/clerk/appearance";

export function ThemedSignIn() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return <SignIn appearance={clerkEmbeddedAppearance(dark)} signUpUrl="/sign-up" />;
}

export function ThemedSignUp() {
  const { resolvedTheme } = useTheme();
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);
  const dark = mounted && resolvedTheme === "dark";
  return <SignUp appearance={clerkEmbeddedAppearance(dark)} signInUrl="/sign-in" />;
}
