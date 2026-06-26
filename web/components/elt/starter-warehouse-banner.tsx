import Link from "next/link";
import { ArrowRight, Database } from "lucide-react";
import { ConnectorIcon } from "@/components/marketing/connector-icon";

/** Shown on Home when the workspace has no default warehouse yet. */
export function StarterWarehouseBanner() {
  return (
    <div className="overflow-hidden rounded-2xl border border-amber-200 bg-gradient-to-r from-amber-50 to-orange-50/80 dark:border-amber-900/50 dark:from-amber-950/40 dark:to-orange-950/20">
      <div className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-start gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-amber-500 text-white">
            <Database className="h-5 w-5" aria-hidden />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900 dark:text-white">
              No warehouse yet — most of eltPulse needs somewhere to land data
            </p>
            <p className="mt-0.5 flex flex-wrap items-center gap-1.5 text-sm text-slate-600 dark:text-slate-400">
              Get a free{" "}
              <ConnectorIcon slug="motherduck" name="MotherDuck" size={16} />
              <span className="font-medium">MotherDuck</span> starter warehouse in ~2 minutes (no file paths).
            </p>
          </div>
        </div>
        <Link
          href="/starter-warehouse"
          className="inline-flex shrink-0 items-center justify-center gap-2 rounded-lg bg-amber-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-amber-500"
        >
          Set up starter warehouse <ArrowRight className="h-4 w-4" aria-hidden />
        </Link>
      </div>
    </div>
  );
}
