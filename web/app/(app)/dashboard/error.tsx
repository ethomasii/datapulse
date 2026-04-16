"use client";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-red-200 bg-red-50 p-6 dark:border-red-900/50 dark:bg-red-950/40">
      <h1 className="text-lg font-semibold text-red-900 dark:text-red-100">Dashboard failed to load</h1>
      <p className="text-sm text-red-800 dark:text-red-200">
        Something went wrong on the server. If you recently deployed, ensure database migrations have been applied
        (for example <code className="rounded bg-red-100 px-1 font-mono text-xs dark:bg-red-900/80">npx prisma migrate deploy</code>{" "}
        against production).
      </p>
      {error.digest ? (
        <p className="font-mono text-xs text-red-700 dark:text-red-300">Digest: {error.digest}</p>
      ) : null}
      <button
        type="button"
        onClick={() => reset()}
        className="rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white hover:bg-red-800 dark:bg-red-600 dark:hover:bg-red-500"
      >
        Try again
      </button>
    </div>
  );
}
