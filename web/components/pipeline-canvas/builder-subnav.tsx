"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import clsx from "clsx";

function BuilderSubnavInner() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const pipelineId = searchParams.get("pipeline")?.trim() || null;
  const builderHref = pipelineId
    ? `/builder?pipeline=${encodeURIComponent(pipelineId)}`
    : "/builder";
  const canvasHref = pipelineId
    ? `/builder/canvas?pipeline=${encodeURIComponent(pipelineId)}`
    : "/builder/canvas";

  const tabs = [
    { href: builderHref, label: "Form builder" },
    { href: canvasHref, label: "Visual canvas" },
  ];

  return (
    <nav className="flex justify-center gap-1" aria-label="Pipeline builder">
      {tabs.map((t) => {
        const active =
          t.href.startsWith("/builder/canvas")
            ? pathname.startsWith("/builder/canvas")
            : pathname === "/builder";
        return (
          <Link
            key={t.label}
            href={t.href}
            className={clsx(
              "-mb-px inline-flex border-b-2 px-4 py-2.5 text-sm font-medium transition",
              active
                ? "border-sky-600 text-sky-700 dark:border-sky-500 dark:text-sky-300"
                : "border-transparent text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:text-slate-400 dark:hover:border-slate-600 dark:hover:text-white"
            )}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

export function BuilderSubnav() {
  return <BuilderSubnavInner />;
}
