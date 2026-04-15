import Link from "next/link";
import type { LucideIcon } from "lucide-react";

type RelatedLinkItem = {
  href: string;
  icon: LucideIcon;
  label: string;
  desc: string;
};

function RelatedLinkCard({ href, icon: Icon, label, desc }: RelatedLinkItem) {
  return (
    <li>
      <Link
        href={href}
        className="flex items-start gap-3 rounded-lg border border-slate-200 bg-white p-3 text-sm transition hover:border-sky-300 hover:bg-sky-50/40 dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-700 dark:hover:bg-sky-950/20"
      >
        <Icon className="mt-0.5 h-4 w-4 shrink-0 text-slate-400 dark:text-slate-500" />
        <div>
          <p className="font-medium text-slate-800 dark:text-slate-200">{label}</p>
          <p className="text-xs text-slate-500 dark:text-slate-400">{desc}</p>
        </div>
      </Link>
    </li>
  );
}

export function RelatedLinks({ links }: { links: RelatedLinkItem[] }) {
  return (
    <section>
      <h2 className="mb-3 text-sm font-semibold uppercase tracking-widest text-slate-400 dark:text-slate-500">
        Related
      </h2>
      <ul className="grid gap-2 sm:grid-cols-2">
        {links.map((link) => (
          <RelatedLinkCard key={link.href} {...link} />
        ))}
      </ul>
    </section>
  );
}
