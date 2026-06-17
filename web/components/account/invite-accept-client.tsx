"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useAuth } from "@clerk/nextjs";
import { Building2, CheckCircle2, Loader2 } from "lucide-react";

export function InviteAcceptClient({
  inviteId,
  organizationName,
}: {
  inviteId: string;
  organizationName: string;
}) {
  const { isSignedIn, isLoaded } = useAuth();
  const [status, setStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded || !isSignedIn || status !== "idle") return;
    setStatus("loading");
    void fetch("/api/organization/invite/accept", {
      method: "POST",
      credentials: "same-origin",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ inviteId }),
    })
      .then(async (res) => {
        const data = (await res.json()) as { error?: string; organizationName?: string };
        if (!res.ok) throw new Error(data.error ?? "Could not accept invite");
        setStatus("done");
      })
      .catch((e) => {
        setStatus("error");
        setError(e instanceof Error ? e.message : "Failed");
      });
  }, [isLoaded, isSignedIn, inviteId, status]);

  if (!isLoaded) {
    return <p className="text-sm text-slate-500">Loading…</p>;
  }

  if (!isSignedIn) {
    const signUp = `/sign-up?redirect_url=${encodeURIComponent(`/invite/${inviteId}`)}`;
    const signIn = `/sign-in?redirect_url=${encodeURIComponent(`/invite/${inviteId}`)}`;
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-slate-200 bg-white p-8 text-center shadow-sm dark:border-slate-800 dark:bg-slate-900">
        <Building2 className="mx-auto h-10 w-10 text-sky-600" />
        <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">Join {organizationName}</h1>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
          Sign in or create an account with the email address that received this invite.
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            href={signUp}
            className="rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
          >
            Sign up
          </Link>
          <Link
            href={signIn}
            className="rounded-lg border border-slate-300 px-4 py-2 text-sm font-medium hover:bg-slate-50 dark:border-slate-600 dark:hover:bg-slate-800"
          >
            Sign in
          </Link>
        </div>
      </div>
    );
  }

  if (status === "loading" || status === "idle") {
    return (
      <div className="flex items-center justify-center gap-2 text-sm text-slate-600">
        <Loader2 className="h-4 w-4 animate-spin" /> Accepting invitation…
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-red-200 bg-red-50 p-6 text-center dark:border-red-900 dark:bg-red-950/40">
        <p className="text-sm text-red-800 dark:text-red-200">{error}</p>
        <Link href="/team" className="mt-4 inline-block text-sm font-medium text-sky-600 hover:underline">
          Go to team
        </Link>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-md rounded-2xl border border-emerald-200 bg-emerald-50 p-8 text-center dark:border-emerald-900 dark:bg-emerald-950/40">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald-600" />
      <h1 className="mt-4 text-xl font-bold text-slate-900 dark:text-white">You&apos;re in!</h1>
      <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
        Welcome to <strong>{organizationName}</strong>.
      </p>
      <Link
        href="/team"
        className="mt-6 inline-block rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500"
      >
        Open team workspace
      </Link>
    </div>
  );
}
