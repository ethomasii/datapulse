import Link from "next/link";

const repo = "https://github.com/ethomasii/datapulse";

export function MarketingFooter() {
  return (
    <footer className="border-t border-slate-200 bg-slate-50 py-10 dark:border-slate-800 dark:bg-slate-950">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-4 text-sm text-slate-600 dark:text-slate-400 sm:flex-row sm:items-center sm:justify-between sm:px-6">
        <p>© {new Date().getFullYear()} DataPulse</p>
        <div className="flex flex-wrap gap-4">
          <Link href="/privacy" className="hover:text-slate-900 dark:hover:text-slate-200">
            Privacy
          </Link>
          <Link href="/terms" className="hover:text-slate-900 dark:hover:text-slate-200">
            Terms
          </Link>
          <a
            href={repo}
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-slate-900 dark:hover:text-slate-200"
          >
            GitHub
          </a>
        </div>
      </div>
    </footer>
  );
}
