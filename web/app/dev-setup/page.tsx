import Link from "next/link";
import { isClerkConfigured } from "@/lib/clerk/is-configured";

function envStatus(label: string, ok: boolean, hint: string) {
  return (
    <li className="flex gap-3 rounded-lg border border-slate-200 bg-white px-4 py-3 dark:border-slate-800 dark:bg-slate-900">
      <span
        className={`mt-0.5 h-2.5 w-2.5 shrink-0 rounded-full ${ok ? "bg-emerald-500" : "bg-amber-500"}`}
        aria-hidden
      />
      <div>
        <p className="font-medium text-slate-900 dark:text-white">{label}</p>
        <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">{hint}</p>
      </div>
    </li>
  );
}

export default function DevSetupPage() {
  const hasDatabase = Boolean(process.env.DATABASE_URL?.trim());
  const hasDirectUrl = Boolean(process.env.DIRECT_URL?.trim());
  const clerkOk = isClerkConfigured();

  return (
    <main className="mx-auto min-h-screen max-w-2xl px-6 py-16">
      <h1 className="text-2xl font-bold text-slate-900 dark:text-white">Local dev setup</h1>
      <p className="mt-3 text-slate-600 dark:text-slate-300">
        The app needs a few environment variables before authenticated routes work. Create{" "}
        <code className="rounded bg-slate-100 px-1.5 py-0.5 text-sm dark:bg-slate-800">web/.env.local</code> from the
        example file, then fill in your keys.
      </p>

      <pre className="mt-6 overflow-x-auto rounded-xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm text-slate-100 dark:border-slate-700">
        cd web{"\n"}cp .env.example .env.local
      </pre>

      <ul className="mt-8 space-y-3">
        {envStatus(
          "Clerk auth",
          clerkOk,
          clerkOk
            ? "Publishable key detected — sign-in should work."
            : "Set NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY and CLERK_SECRET_KEY from clerk.com → API keys."
        )}
        {envStatus(
          "Database",
          hasDatabase,
          hasDatabase
            ? "DATABASE_URL is set."
            : "Set DATABASE_URL to a Postgres URI (local Docker or Neon connection string)."
        )}
        {envStatus(
          "Direct DB URL",
          hasDirectUrl,
          hasDirectUrl
            ? "DIRECT_URL is set (required for prisma migrate deploy / build)."
            : "Set DIRECT_URL — same as DATABASE_URL for local Postgres; use Neon’s direct URI when pooled."
        )}
      </ul>

      <p className="mt-8 text-sm text-slate-600 dark:text-slate-400">
        After editing <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">.env.local</code>, restart{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run dev</code>. For a fresh schema:{" "}
        <code className="rounded bg-slate-100 px-1 dark:bg-slate-800">npm run db:migrate</code>.
      </p>

      <div className="mt-6 flex flex-wrap gap-3">
        <Link href="/" className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400">
          ← Marketing home
        </Link>
        <a
          href="https://dashboard.clerk.com/last-active?path=api-keys"
          className="text-sm font-medium text-sky-600 hover:underline dark:text-sky-400"
          target="_blank"
          rel="noreferrer"
        >
          Clerk API keys →
        </a>
      </div>
    </main>
  );
}
