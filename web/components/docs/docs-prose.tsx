import type { ReactNode } from "react";

export function DocsProse({ children }: { children: ReactNode }) {
  return (
    <div className="prose prose-slate max-w-none dark:prose-invert prose-headings:font-semibold prose-headings:tracking-tight prose-h1:text-3xl prose-h2:mt-10 prose-h2:text-xl prose-h2:scroll-mt-24 prose-h3:text-lg prose-a:text-sky-600 prose-a:no-underline hover:prose-a:underline dark:prose-a:text-sky-400 prose-code:rounded-md prose-code:bg-slate-100 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-sm prose-code:font-normal prose-code:before:content-none prose-code:after:content-none dark:prose-code:bg-slate-800 prose-li:marker:text-slate-400">
      {children}
    </div>
  );
}
