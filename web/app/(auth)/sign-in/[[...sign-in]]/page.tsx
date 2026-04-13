import Link from "next/link";
import { Activity } from "lucide-react";
import { ThemedSignIn } from "@/components/auth/themed-clerk-auth";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mb-8 flex w-full max-w-md justify-center sm:max-w-lg">
        <div className="flex items-center gap-2">
          <Activity className="h-6 w-6 text-sky-600" aria-hidden />
          <Link href="/" className="text-xl font-bold text-slate-900 dark:text-slate-100">
            eltPulse
          </Link>
        </div>
      </div>
      <div className="w-full max-w-md sm:max-w-lg">
        <ThemedSignIn />
      </div>
    </div>
  );
}
