import Link from "next/link";
import { Activity } from "lucide-react";
import { ThemedSignUp } from "@/components/auth/themed-clerk-auth";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-slate-50 px-4 py-8 dark:bg-slate-950">
      <div className="mb-8 flex items-center gap-2">
        <Activity className="h-6 w-6 text-sky-600" aria-hidden />
        <Link href="/" className="text-xl font-bold text-slate-900 dark:text-slate-100">
          DataPulse
        </Link>
      </div>
      <ThemedSignUp />
    </div>
  );
}
