import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ArrowRight, Check, CheckCircle, X, XCircle } from "lucide-react";
import { COMPETITORS, COMPETITOR_MAP } from "@/lib/marketing/competitors";

export function generateStaticParams() {
  return COMPETITORS.map((c) => ({ slug: c.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: { slug: string };
}): Promise<Metadata> {
  const c = COMPETITOR_MAP[params.slug];
  if (!c) return {};
  return {
    title: `${c.tagline} — eltPulse`,
    description: c.heroSubtitle,
  };
}

function FeatureCell({ value }: { value: boolean | string }) {
  if (value === true) return <Check className="mx-auto h-5 w-5 text-blue-600" />;
  if (value === false) return <X className="mx-auto h-4 w-4 text-slate-300" />;
  return <span className="text-sm font-medium text-slate-700 dark:text-slate-300">{value}</span>;
}

export default function VsPage({ params }: { params: { slug: string } }) {
  const c = COMPETITOR_MAP[params.slug];
  if (!c) notFound();

  const idx = COMPETITORS.findIndex((x) => x.slug === params.slug);
  const prev = idx > 0 ? COMPETITORS[idx - 1] : null;
  const next = idx < COMPETITORS.length - 1 ? COMPETITORS[idx + 1] : null;

  return (
    <div className="bg-white dark:bg-slate-950">
      <section className="bg-slate-100 py-24 dark:bg-slate-950">
        <div className="mx-auto max-w-4xl px-6">
          <Link
            href="/compare"
            className="mb-6 inline-flex items-center gap-1.5 text-sm text-slate-600 transition hover:text-slate-900 dark:text-slate-400 dark:hover:text-white"
          >
            <ArrowLeft className="h-4 w-4" />
            All comparisons
          </Link>
          <span className="mb-4 block w-fit rounded-full border border-blue-500/30 bg-blue-500/10 px-4 py-1 text-xs font-semibold uppercase tracking-widest text-blue-600 dark:text-blue-400">
            eltPulse vs. {c.name}
          </span>
          <h1 className="mt-4 text-4xl font-bold leading-tight text-slate-900 dark:text-white sm:text-5xl">
            {c.tagline}
          </h1>
          <p className="mt-6 max-w-2xl text-xl leading-relaxed text-slate-600 dark:text-slate-300">
            {c.heroSubtitle}
          </p>
          <div className="mt-8 flex flex-wrap gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-blue-600 px-6 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Try eltPulse free →
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-slate-300 px-6 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 hover:text-slate-900 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500 dark:hover:text-white"
            >
              See pricing
            </Link>
          </div>
        </div>
      </section>

      <section className="border-b border-slate-200 py-14 dark:border-slate-800">
        <div className="mx-auto max-w-4xl px-6">
          <p className="text-lg leading-relaxed text-slate-600 dark:text-slate-400">{c.description}</p>
        </div>
      </section>

      <section className="bg-slate-50 py-14 dark:bg-slate-900">
        <div className="mx-auto max-w-4xl px-6">
          <div className="grid gap-8 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 dark:border-slate-800 dark:bg-slate-950">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-slate-600 dark:text-slate-400">
                Where {c.name} shines
              </h2>
              <ul className="space-y-3">
                {c.theyreGoodAt.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm text-slate-700 dark:text-slate-300">
                    <CheckCircle className="mt-0.5 h-4 w-4 shrink-0 text-green-500" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
            <div className="rounded-2xl border border-red-100 bg-white p-6 dark:border-red-900/30 dark:bg-slate-950">
              <h2 className="mb-4 text-sm font-semibold uppercase tracking-widest text-red-900 dark:text-red-200">
                Where {c.name} and eltPulse differ
              </h2>
              <ul className="space-y-3">
                {c.whereTheyFallShort.map((item) => (
                  <li key={item} className="flex items-start gap-2.5 text-sm leading-snug text-slate-700 dark:text-slate-300">
                    <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-red-400" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>

          <div className="mt-6 rounded-2xl border border-amber-200 bg-amber-50 px-6 py-4 dark:border-amber-900/40 dark:bg-amber-950/30">
            <span className="text-xs font-semibold uppercase tracking-widest text-amber-700 dark:text-amber-400">
              Best fit for {c.name}
            </span>
            <p className="mt-1 text-sm text-amber-900 dark:text-amber-200">{c.bestFor}</p>
          </div>
        </div>
      </section>

      <section className="py-16">
        <div className="mx-auto max-w-4xl px-6">
          <h2 className="mb-8 text-center text-2xl font-bold text-slate-900 dark:text-white">
            Feature-by-feature comparison
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-200 dark:border-slate-800">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50 dark:border-slate-800 dark:bg-slate-900">
                  <th className="w-1/2 px-6 py-4 text-left text-sm font-semibold text-slate-700 dark:text-slate-300">
                    Feature
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-blue-700 dark:text-blue-400">
                    eltPulse
                  </th>
                  <th className="px-6 py-4 text-center text-sm font-semibold text-slate-500 dark:text-slate-400">
                    {c.name}
                  </th>
                </tr>
              </thead>
              <tbody>
                {c.categories.flatMap((cat, catIdx) => [
                  <tr key={`cat-${catIdx}`}>
                    <td
                      colSpan={3}
                      className="bg-slate-100 px-6 py-2 text-xs font-semibold uppercase tracking-widest text-slate-500 dark:bg-slate-900 dark:text-slate-400"
                    >
                      {cat.category}
                    </td>
                  </tr>,
                  ...cat.rows.map((row, rowIdx) => (
                    <tr
                      key={`${catIdx}-${rowIdx}`}
                      className={rowIdx % 2 === 0 ? "bg-white dark:bg-slate-950" : "bg-slate-50/50 dark:bg-slate-900/50"}
                    >
                      <td className="px-6 py-3 text-sm text-slate-700 dark:text-slate-300">
                        {row.feature}
                        {row.note ? (
                          <span className="ml-2 text-xs italic text-slate-400">({row.note})</span>
                        ) : null}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <FeatureCell value={row.eltpulse} />
                      </td>
                      <td className="px-6 py-3 text-center">
                        <FeatureCell value={row.competitor} />
                      </td>
                    </tr>
                  )),
                ])}
              </tbody>
            </table>
          </div>
        </div>
      </section>

      <section className="border-t border-slate-200 bg-slate-50 py-14 dark:border-slate-800 dark:bg-slate-900">
        <div className="mx-auto max-w-3xl px-6 text-center">
          <h2 className="text-2xl font-bold text-slate-900 dark:text-white">The bottom line</h2>
          <p className="mt-4 text-lg leading-relaxed text-slate-600 dark:text-slate-400">{c.closingNote}</p>
          <div className="mt-8 flex flex-wrap justify-center gap-4">
            <Link
              href="/sign-up"
              className="rounded-lg bg-blue-600 px-8 py-3 text-sm font-semibold text-white transition hover:bg-blue-500"
            >
              Try eltPulse free →
            </Link>
            <Link
              href="/pricing"
              className="rounded-lg border border-slate-200 px-8 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-400 dark:border-slate-700 dark:text-slate-300 dark:hover:border-slate-500"
            >
              Compare plans
            </Link>
          </div>
        </div>
      </section>

      {(prev || next) && (
        <section className="border-t border-slate-200 py-8 dark:border-slate-800">
          <div className="mx-auto flex max-w-4xl items-center justify-between px-6">
            {prev ? (
              <Link
                href={`/compare/${prev.slug}`}
                className="group flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <ArrowLeft className="h-4 w-4 transition group-hover:-translate-x-1" />
                <span>
                  vs. <span className="font-medium">{prev.name}</span>
                </span>
              </Link>
            ) : (
              <div />
            )}
            {next ? (
              <Link
                href={`/compare/${next.slug}`}
                className="group flex items-center gap-2 text-sm text-slate-500 transition hover:text-blue-600 dark:text-slate-400 dark:hover:text-blue-400"
              >
                <span>
                  vs. <span className="font-medium">{next.name}</span>
                </span>
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-1" />
              </Link>
            ) : (
              <div />
            )}
          </div>
        </section>
      )}
    </div>
  );
}
