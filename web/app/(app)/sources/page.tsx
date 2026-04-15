'use client';

import { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  BookOpen,
  CheckCircle,
  ChevronRight,
  ExternalLink,
  Layers,
  RefreshCw,
  Search,
  Sparkles,
  Zap,
} from 'lucide-react';
import { RelatedLinks } from '@/components/ui/related-links';
import { DLT_HUB_SOURCES, getDltHubSourcesByCategory, type DltHubSource } from '@/lib/elt/dlt-hub-registry';

const CATEGORY_ORDER = [
  'CRM & Sales',
  'Marketing',
  'Analytics',
  'Support & Ops',
  'Productivity',
  'Developer & Code',
  'Databases',
  'Storage & Files',
  'Other',
];

const CATEGORY_COLORS: Record<string, string> = {
  'CRM & Sales':    'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/20 dark:text-emerald-400',
  'Marketing':      'bg-pink-50 text-pink-700 dark:bg-pink-900/20 dark:text-pink-400',
  'Analytics':      'bg-purple-50 text-purple-700 dark:bg-purple-900/20 dark:text-purple-400',
  'Support & Ops':  'bg-orange-50 text-orange-700 dark:bg-orange-900/20 dark:text-orange-400',
  'Productivity':   'bg-blue-50 text-blue-700 dark:bg-blue-900/20 dark:text-blue-400',
  'Developer & Code':'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
  'Databases':      'bg-yellow-50 text-yellow-700 dark:bg-yellow-900/20 dark:text-yellow-400',
  'Storage & Files':'bg-sky-50 text-sky-700 dark:bg-sky-900/20 dark:text-sky-400',
  'Other':          'bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400',
};

function SourceCard({ source }: { source: DltHubSource }) {
  return (
    <div className="group flex flex-col gap-2 rounded-xl border border-slate-200 bg-white p-4 hover:border-teal-300 hover:shadow-sm dark:border-slate-800 dark:bg-slate-900 dark:hover:border-teal-700 transition-all">
      <div className="flex items-start justify-between gap-2">
        <div>
          <h3 className="font-semibold text-slate-900 dark:text-white">{source.name}</h3>
          <code className="text-[10px] text-slate-400 font-mono">{source.slug}</code>
        </div>
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-[10px] font-medium ${CATEGORY_COLORS[source.category] ?? CATEGORY_COLORS.Other}`}>
          {source.category}
        </span>
      </div>

      <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">{source.description}</p>

      <div className="flex flex-wrap gap-1 mt-auto pt-1">
        {source.incremental && (
          <span className="flex items-center gap-0.5 rounded-full bg-teal-50 px-2 py-0.5 text-[10px] text-teal-700 dark:bg-teal-900/20 dark:text-teal-400">
            <Zap className="h-2.5 w-2.5" /> Incremental
          </span>
        )}
        {source.auth.slice(0, 1).map((a) => (
          <span key={a} className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-500 dark:bg-slate-800 dark:text-slate-400">
            {a}
          </span>
        ))}
      </div>

      <div className="flex items-center gap-2 border-t border-slate-100 pt-2 dark:border-slate-800">
        <Link
          href={`/builder?source=${source.slug}`}
          className="flex flex-1 items-center justify-center gap-1 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
        >
          <Layers className="h-3 w-3" /> Build pipeline
        </Link>
        {source.docsUrl && (
          <a
            href={source.docsUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-3 py-1.5 text-xs text-slate-500 hover:text-slate-900 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="h-3 w-3" /> Docs
          </a>
        )}
      </div>
    </div>
  );
}

export default function SourcesPage() {
  const [query, setQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);

  const byCategory = useMemo(() => getDltHubSourcesByCategory(), []);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return DLT_HUB_SOURCES.filter((s) => {
      const matchesQuery = !q || s.slug.includes(q) || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.category.toLowerCase().includes(q);
      const matchesCategory = !selectedCategory || s.category === selectedCategory;
      return matchesQuery && matchesCategory;
    });
  }, [query, selectedCategory]);

  const groupedFiltered = useMemo(() => {
    const groups: Record<string, DltHubSource[]> = {};
    for (const s of filtered) {
      if (!groups[s.category]) groups[s.category] = [];
      groups[s.category].push(s);
    }
    return groups;
  }, [filtered]);

  const categories = CATEGORY_ORDER.filter((c) => byCategory[c]?.length);

  return (
    <div className="w-full min-w-0 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div>
        <div className="inline-flex items-center gap-2 text-teal-600 dark:text-teal-400">
          <BookOpen className="h-6 w-6" aria-hidden />
          <span className="text-sm font-semibold uppercase tracking-wide">Source Registry</span>
        </div>
        <h1 className="mt-2 text-2xl font-bold text-slate-900 dark:text-white">Verified Sources</h1>
        <p className="mt-3 text-slate-600 dark:text-slate-300">
          {DLT_HUB_SOURCES.length} pre-built, verified connectors — each with auth, pagination, schema inference,
          and incremental loading built in. Click any source to open the pipeline builder pre-configured for it,
          or use the{' '}
          <span className="inline-flex items-center gap-1 font-medium text-teal-700 dark:text-teal-400">
            <Sparkles className="h-3.5 w-3.5" /> AI Builder
          </span>{' '}
          to describe what you want in plain English.
        </p>
      </div>

      {/* Stats bar */}
      <div className="flex flex-wrap gap-4 rounded-xl border border-slate-200 bg-slate-50 px-5 py-4 dark:border-slate-800 dark:bg-slate-900/40">
        <div className="text-center">
          <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{DLT_HUB_SOURCES.length}</p>
          <p className="text-xs text-slate-500">Connectors</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{DLT_HUB_SOURCES.filter(s => s.incremental).length}</p>
          <p className="text-xs text-slate-500">Incremental</p>
        </div>
        <div className="text-center">
          <p className="text-xl font-bold text-teal-600 dark:text-teal-400">{categories.length}</p>
          <p className="text-xs text-slate-500">Categories</p>
        </div>
        <div className="ml-auto flex items-center">
          <a
            href="https://github.com/dlt-hub/verified-sources"
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-600 hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" /> Connector source code
          </a>
        </div>
      </div>

      {/* Search + Category filter */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search sources…"
            className="w-full rounded-lg border border-slate-200 bg-white py-2 pl-9 pr-3 text-sm text-slate-900 placeholder-slate-400 outline-none focus:border-teal-500 dark:border-slate-700 dark:bg-slate-900 dark:text-white dark:placeholder-slate-500"
          />
        </div>
        <div className="flex flex-wrap gap-1.5">
          <button
            onClick={() => setSelectedCategory(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!selectedCategory ? 'bg-teal-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'}`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              onClick={() => setSelectedCategory(selectedCategory === cat ? null : cat)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${selectedCategory === cat ? 'bg-teal-600 text-white' : 'border border-slate-200 text-slate-600 hover:border-slate-300 dark:border-slate-700 dark:text-slate-400'}`}
            >
              {cat}
            </button>
          ))}
        </div>
      </div>

      {/* Source grid */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 p-10 text-center dark:border-slate-700">
          <Search className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-2 text-sm text-slate-500">No sources match &quot;{query}&quot;. Try the REST API source for custom HTTP APIs.</p>
        </div>
      ) : query || selectedCategory ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((s) => <SourceCard key={s.slug} source={s} />)}
        </div>
      ) : (
        CATEGORY_ORDER.filter((c) => groupedFiltered[c]?.length).map((cat) => (
          <section key={cat}>
            <div className="mb-3 flex items-center gap-2">
              <h2 className="text-sm font-semibold text-slate-900 dark:text-white">{cat}</h2>
              <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-500 dark:bg-slate-800 dark:text-slate-400">
                {groupedFiltered[cat].length}
              </span>
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {groupedFiltered[cat].map((s) => <SourceCard key={s.slug} source={s} />)}
            </div>
          </section>
        ))
      )}

      {/* Sling note */}
      <section className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/80 p-6 dark:border-slate-700 dark:bg-slate-900/40">
        <div className="flex items-start gap-3">
          <RefreshCw className="mt-0.5 h-5 w-5 shrink-0 text-teal-600" />
          <div>
            <h2 className="text-sm font-semibold text-slate-900 dark:text-white">Database-to-database pipelines</h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-300">
              For Postgres → Snowflake, MySQL → BigQuery, and similar moves, eltPulse uses a high-performance
              replication engine with row-level incremental support, CDC from Postgres, and native SQL type mapping.
              Build a database pipeline from the{' '}
              <Link href="/builder" className="font-medium text-sky-600 hover:underline dark:text-sky-400">Pipeline Builder</Link>{' '}
              and select any database source.
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
              {['postgres', 'mysql', 'mongodb', 'mssql', 'oracle', 'sqlite'].map((db) => (
                <Link
                  key={db}
                  href={`/builder?source=${db}`}
                  className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1 text-xs text-slate-600 hover:border-teal-400 hover:text-teal-700 dark:border-slate-700 dark:text-slate-400 dark:hover:border-teal-600 dark:hover:text-teal-400 transition-colors"
                >
                  <ChevronRight className="h-3 w-3" /> {db}
                </Link>
              ))}
            </div>
          </div>
        </div>
      </section>

      <RelatedLinks links={[
        { href: '/builder', icon: Layers, label: 'Pipeline Builder', desc: 'Build a pipeline from any source to any destination' },
        { href: '/run-slices', icon: Zap, label: 'Run Slices', desc: 'Configure incremental loading and backfills' },
        { href: '/runs', icon: CheckCircle, label: 'Runs', desc: 'Monitor pipeline execution and telemetry' },
      ]} />
    </div>
  );
}
