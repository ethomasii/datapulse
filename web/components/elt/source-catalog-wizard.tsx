'use client';

import { useState, useCallback, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import {
  Search, ChevronRight, ChevronLeft, Loader2, CheckCircle,
  ExternalLink, AlertCircle, Zap, Database, RefreshCw,
} from 'lucide-react';
import { ALL_DLT_SOURCES, getContextSlug, type DltHubSource } from '@/lib/elt/dlt-hub-registry';
import { DESTINATION_GROUPS } from '@/lib/elt/catalog';
import type { DltSourceContext, DltContextEndpoint } from '@/app/api/elt/source-context/[slug]/route';
import type { CreatePipelineBody } from '@/lib/elt/types';

// ── Types ─────────────────────────────────────────────────────────────────────

type WizardStep = 'browse' | 'configure' | 'review';

type WizardState = {
  step: WizardStep;
  source: DltHubSource | null;
  context: DltSourceContext | null;
  contextLoading: boolean;
  contextError: string | null;
  selectedEndpoints: Set<string>;
  authValues: Record<string, string>;
  destination: string;
  pipelineName: string;
  saving: boolean;
  saved: boolean;
  savedId: string | null;
  saveError: string | null;
};

const CATEGORY_ORDER = [
  'CRM & Sales', 'Marketing', 'Analytics', 'Support & Ops',
  'Developer & Code', 'Storage & Files', 'Databases', 'Productivity', 'Other',
];

// ── Category badge colours ────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  'CRM & Sales': 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300',
  'Marketing': 'bg-pink-100 text-pink-700 dark:bg-pink-900/30 dark:text-pink-300',
  'Analytics': 'bg-purple-100 text-purple-700 dark:bg-purple-900/30 dark:text-purple-300',
  'Support & Ops': 'bg-orange-100 text-orange-700 dark:bg-orange-900/30 dark:text-orange-300',
  'Developer & Code': 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300',
  'Storage & Files': 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300',
  'Databases': 'bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300',
  'Productivity': 'bg-sky-100 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300',
  'Other': 'bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-300',
};

// ── Source card ───────────────────────────────────────────────────────────────

function SourceCard({ source, onSelect }: { source: DltHubSource; onSelect: () => void }) {
  const catColor = CATEGORY_COLORS[source.category] ?? CATEGORY_COLORS['Other'];
  return (
    <button
      onClick={onSelect}
      className="group text-left rounded-xl border border-slate-200 bg-white p-4 hover:border-sky-400 hover:shadow-sm transition-all dark:border-slate-700 dark:bg-slate-900 dark:hover:border-sky-500"
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1 min-w-0">
          <p className="font-semibold text-slate-900 dark:text-white truncate">{source.name}</p>
          <p className="mt-0.5 text-xs text-slate-500 dark:text-slate-400 line-clamp-2">{source.description}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-slate-400 group-hover:text-sky-500 mt-0.5 transition-colors" />
      </div>
      <div className="mt-2 flex items-center gap-2 flex-wrap">
        <span className={`inline-block rounded-full px-2 py-0.5 text-[10px] font-medium ${catColor}`}>
          {source.category}
        </span>
        {source.sourceType === 'verified' && (
          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-teal-100 text-teal-700 dark:bg-teal-900/30 dark:text-teal-300">
            dlt verified
          </span>
        )}
        {source.incremental && (
          <span className="inline-block rounded-full px-2 py-0.5 text-[10px] font-medium bg-slate-100 text-slate-600 dark:bg-slate-800 dark:text-slate-400">
            incremental
          </span>
        )}
      </div>
    </button>
  );
}

// ── Browse step ───────────────────────────────────────────────────────────────

function BrowseStep({ onSelect }: { onSelect: (s: DltHubSource) => void }) {
  const [query, setQuery] = useState('');
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = query.toLowerCase().trim();
    return ALL_DLT_SOURCES.filter((s) => {
      const matchesCategory = !activeCategory || s.category === activeCategory;
      const matchesQuery = !q || s.name.toLowerCase().includes(q) || s.description.toLowerCase().includes(q) || s.slug.includes(q) || s.category.toLowerCase().includes(q);
      return matchesCategory && matchesQuery;
    });
  }, [query, activeCategory]);

  const categoryCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const s of ALL_DLT_SOURCES) counts[s.category] = (counts[s.category] ?? 0) + 1;
    return counts;
  }, []);

  return (
    <div className="flex flex-col gap-4">
      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder={`Search ${ALL_DLT_SOURCES.length} sources…`}
          className="w-full rounded-lg border border-slate-300 bg-white pl-9 pr-4 py-2 text-sm dark:border-slate-600 dark:bg-slate-900 dark:text-white placeholder-slate-400 focus:border-sky-500 outline-none"
          autoFocus
        />
      </div>

      {/* Category filter pills */}
      <div className="flex flex-wrap gap-1.5">
        <button
          onClick={() => setActiveCategory(null)}
          className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${!activeCategory ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
        >
          All ({ALL_DLT_SOURCES.length})
        </button>
        {CATEGORY_ORDER.filter((c) => categoryCounts[c]).map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(activeCategory === cat ? null : cat)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${activeCategory === cat ? 'bg-sky-600 text-white' : 'bg-slate-100 text-slate-600 hover:bg-slate-200 dark:bg-slate-800 dark:text-slate-300'}`}
          >
            {cat} ({categoryCounts[cat]})
          </button>
        ))}
      </div>

      {/* Source grid */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-slate-500 dark:text-slate-400">
          <Search className="h-8 w-8 mx-auto mb-2 text-slate-300" />
          <p>No sources match &quot;{query}&quot;</p>
          <button onClick={() => { setQuery(''); setActiveCategory(null); }} className="mt-2 text-sm text-sky-600 hover:underline">Clear filters</button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-[520px] overflow-y-auto pr-1">
          {filtered.map((s) => (
            <SourceCard key={s.slug} source={s} onSelect={() => onSelect(s)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Configure step ────────────────────────────────────────────────────────────

function ConfigureStep({
  source,
  context,
  loading,
  error,
  selectedEndpoints,
  onToggleEndpoint,
  onToggleAll,
  authValues,
  onAuthChange,
  destination,
  onDestinationChange,
  pipelineName,
  onNameChange,
  onBack,
  onNext,
}: {
  source: DltHubSource;
  context: DltSourceContext | null;
  loading: boolean;
  error: string | null;
  selectedEndpoints: Set<string>;
  onToggleEndpoint: (name: string) => void;
  onToggleAll: (endpoints: DltContextEndpoint[]) => void;
  authValues: Record<string, string>;
  onAuthChange: (k: string, v: string) => void;
  destination: string;
  onDestinationChange: (d: string) => void;
  pipelineName: string;
  onNameChange: (n: string) => void;
  onBack: () => void;
  onNext: () => void;
}) {
  const canProceed = context && selectedEndpoints.size > 0 && pipelineName.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <div className="flex-1">
          <h3 className="font-semibold text-slate-900 dark:text-white">{source.name}</h3>
          <p className="text-xs text-slate-500">{source.description}</p>
        </div>
        {context && (
          <a href={context.contextUrl} target="_blank" rel="noreferrer" className="flex items-center gap-1 text-xs text-sky-600 hover:underline">
            <ExternalLink className="h-3 w-3" /> Docs
          </a>
        )}
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-slate-500 py-4">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span className="text-sm">Fetching source config from dlthub.com…</span>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      {context && (
        <>
          {/* Endpoint selector */}
          {context.endpoints.length > 0 && (
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">
                  Resources to load ({selectedEndpoints.size}/{context.endpoints.length} selected)
                </label>
                <button
                  onClick={() => onToggleAll(context.endpoints)}
                  className="text-xs text-sky-600 hover:underline"
                >
                  {selectedEndpoints.size === context.endpoints.length ? 'Deselect all' : 'Select all'}
                </button>
              </div>
              <div className="rounded-lg border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800 max-h-52 overflow-y-auto">
                {context.endpoints.map((ep) => (
                  <label key={ep.name} className="flex items-center gap-3 px-3 py-2 hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedEndpoints.has(ep.name)}
                      onChange={() => onToggleEndpoint(ep.name)}
                      className="rounded border-slate-300 text-sky-600"
                    />
                    <div className="flex-1 min-w-0">
                      <span className="text-sm font-medium text-slate-800 dark:text-slate-200">{ep.name}</span>
                      <span className="ml-2 font-mono text-[11px] text-slate-400 truncate">{ep.path}</span>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <span className="text-[10px] text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-1">{ep.method}</span>
                      {ep.dataSelector && (
                        <span className="text-[10px] text-teal-600 dark:text-teal-400 bg-teal-50 dark:bg-teal-900/20 rounded px-1">→{ep.dataSelector}</span>
                      )}
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}

          {/* Auth */}
          {context.authType !== 'none' && (
            <div>
              <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
                Authentication — {context.authType}
              </label>
              <p className="text-xs text-slate-500 dark:text-slate-400 mb-2">
                This value will be stored as an environment variable on your agent.
                Suggested env var: <code className="font-mono bg-slate-100 dark:bg-slate-800 px-1 rounded">{context.authEnvHint}</code>
              </p>
              <input
                type="password"
                value={authValues[context.authParam] ?? ''}
                onChange={(e) => onAuthChange(context.authParam, e.target.value)}
                placeholder={`${context.authEnvHint} value`}
                autoComplete="off"
                className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white focus:border-sky-500 outline-none"
              />
            </div>
          )}
        </>
      )}

      {/* Pipeline name */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Pipeline name
        </label>
        <input
          type="text"
          value={pipelineName}
          onChange={(e) => onNameChange(e.target.value.replace(/[^a-zA-Z0-9_]/g, '_').toLowerCase())}
          placeholder={`${source.slug.replace(/-/g, '_')}_pipeline`}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm font-mono dark:text-white focus:border-sky-500 outline-none"
        />
      </div>

      {/* Destination */}
      <div>
        <label className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">
          Destination
        </label>
        <select
          value={destination}
          onChange={(e) => onDestinationChange(e.target.value)}
          className="w-full rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-900 px-3 py-2 text-sm dark:text-white focus:border-sky-500 outline-none"
        >
          {Object.entries(DESTINATION_GROUPS).map(([group, items]) => (
            <optgroup key={group} label={group}>
              {items.map((d) => <option key={d} value={d}>{d}</option>)}
            </optgroup>
          ))}
        </select>
      </div>

      <button
        onClick={onNext}
        disabled={!canProceed}
        className="flex items-center justify-center gap-2 rounded-lg bg-sky-600 px-4 py-2 text-sm font-semibold text-white hover:bg-sky-500 disabled:opacity-50 transition-colors"
      >
        Review pipeline <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
}

// ── Review step ───────────────────────────────────────────────────────────────

function ReviewStep({
  source,
  context,
  selectedEndpoints,
  destination,
  pipelineName,
  saving,
  saved,
  savedId,
  saveError,
  onBack,
  onSave,
}: {
  source: DltHubSource;
  context: DltSourceContext;
  selectedEndpoints: Set<string>;
  destination: string;
  pipelineName: string;
  saving: boolean;
  saved: boolean;
  savedId: string | null;
  saveError: string | null;
  onBack: () => void;
  onSave: () => void;
}) {
  const router = useRouter();
  const endpoints = context.endpoints.filter((ep) => selectedEndpoints.has(ep.name));

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="flex items-center gap-1 text-sm text-slate-500 hover:text-slate-800 dark:hover:text-white transition-colors">
          <ChevronLeft className="h-4 w-4" /> Back
        </button>
        <h3 className="font-semibold text-slate-900 dark:text-white">Review &amp; save</h3>
      </div>

      <div className="rounded-xl border border-slate-200 dark:border-slate-700 divide-y divide-slate-100 dark:divide-slate-800">
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Pipeline</span>
          <span className="text-sm font-mono text-slate-800 dark:text-slate-200">{pipelineName}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Source</span>
          <span className="text-sm text-slate-800 dark:text-slate-200">{source.name}</span>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Destination</span>
          <span className="text-sm text-slate-800 dark:text-slate-200 flex items-center gap-1.5">
            <Database className="h-3.5 w-3.5 text-slate-400" />{destination}
          </span>
        </div>
        <div className="px-4 py-3">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide block mb-2">
            Resources ({endpoints.length})
          </span>
          <div className="flex flex-wrap gap-1.5">
            {endpoints.map((ep) => (
              <span key={ep.name} className="inline-flex items-center gap-1 rounded-full bg-teal-50 dark:bg-teal-900/20 px-2.5 py-0.5 text-xs font-medium text-teal-700 dark:text-teal-300">
                {ep.name}
              </span>
            ))}
          </div>
        </div>
        <div className="px-4 py-3 flex items-center justify-between">
          <span className="text-xs font-medium text-slate-500 uppercase tracking-wide">Auth</span>
          <span className="text-sm text-slate-600 dark:text-slate-400">{context.authType === 'none' ? 'None' : `${context.authType} (env var)`}</span>
        </div>
      </div>

      {saveError && (
        <div className="rounded-lg border border-red-200 bg-red-50 dark:border-red-800 dark:bg-red-900/20 p-3 flex items-start gap-2 text-sm text-red-700 dark:text-red-300">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{saveError}</span>
        </div>
      )}

      {saved ? (
        <div className="flex flex-col gap-3">
          <div className="flex items-center gap-2 text-teal-600 dark:text-teal-400">
            <CheckCircle className="h-5 w-5" />
            <span className="font-semibold">Pipeline saved!</span>
          </div>
          {savedId && (
            <button
              onClick={() => router.push(`/builder?pipeline=${encodeURIComponent(savedId)}`)}
              className="flex items-center gap-2 rounded-lg border border-slate-300 dark:border-slate-600 px-4 py-2 text-sm font-medium text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800 transition-colors"
            >
              <ExternalLink className="h-4 w-4" /> Open in builder
            </button>
          )}
        </div>
      ) : (
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center justify-center gap-2 rounded-lg bg-teal-600 px-4 py-2.5 text-sm font-semibold text-white hover:bg-teal-500 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
          {saving ? 'Saving…' : 'Save pipeline'}
        </button>
      )}
    </div>
  );
}

// ── Main wizard ───────────────────────────────────────────────────────────────

export function SourceCatalogWizard({ onPipelineSaved }: { onPipelineSaved?: (name: string) => void }) {
  const [state, setState] = useState<WizardState>({
    step: 'browse',
    source: null,
    context: null,
    contextLoading: false,
    contextError: null,
    selectedEndpoints: new Set(),
    authValues: {},
    destination: 'duckdb',
    pipelineName: '',
    saving: false,
    saved: false,
    savedId: null,
    saveError: null,
  });

  const fetchContext = useCallback(async (source: DltHubSource) => {
    const contextSlug = getContextSlug(source);
    const defaultName = `${source.slug.replace(/-/g, '_')}_pipeline`;

    setState((prev) => ({
      ...prev,
      step: 'configure',
      source,
      context: null,
      contextLoading: true,
      contextError: null,
      selectedEndpoints: new Set(),
      pipelineName: defaultName,
      saved: false,
      savedId: null,
      saveError: null,
    }));

    try {
      const res = await fetch(`/api/elt/source-context/${encodeURIComponent(contextSlug)}`);
      const data = await res.json() as { context?: DltSourceContext; error?: string };
      if (!res.ok || !data.context) {
        setState((prev) => ({
          ...prev,
          contextLoading: false,
          contextError: data.error ?? 'Could not load source context',
        }));
        return;
      }
      // Default: select first 5 endpoints
      const defaultSelected = new Set(data.context.endpoints.slice(0, 5).map((e) => e.name));
      setState((prev) => ({
        ...prev,
        contextLoading: false,
        context: data.context!,
        selectedEndpoints: defaultSelected,
      }));
    } catch (e) {
      setState((prev) => ({
        ...prev,
        contextLoading: false,
        contextError: e instanceof Error ? e.message : 'Network error',
      }));
    }
  }, []);

  const toggleEndpoint = useCallback((name: string) => {
    setState((prev) => {
      const next = new Set(prev.selectedEndpoints);
      if (next.has(name)) next.delete(name); else next.add(name);
      return { ...prev, selectedEndpoints: next };
    });
  }, []);

  const toggleAll = useCallback((endpoints: DltContextEndpoint[]) => {
    setState((prev) => {
      const allSelected = endpoints.every((e) => prev.selectedEndpoints.has(e.name));
      const next = allSelected ? new Set<string>() : new Set(endpoints.map((e) => e.name));
      return { ...prev, selectedEndpoints: next };
    });
  }, []);

  const savePipeline = useCallback(async () => {
    const { source, context, selectedEndpoints, authValues, destination, pipelineName } = state;
    if (!source || !context) return;

    // Build a filtered RESTAPIConfig with only the selected endpoints
    const filteredResources = (context.restApiConfig.resources as unknown[])?.filter((r) => {
      const name = (r as { name?: string }).name;
      return name && selectedEndpoints.has(name);
    }) ?? [];

    const advancedConfig: Record<string, unknown> = {
      ...context.restApiConfig,
      resources: filteredResources,
    };

    // Inject auth credential into the client config (replace placeholder env var with actual env var name)
    if (context.authType !== 'none' && authValues[context.authParam]) {
      const client = advancedConfig.client as Record<string, unknown>;
      const auth = client?.auth as Record<string, unknown> | undefined;
      if (auth) {
        // Store the env var name, not the value — consistent with how dlt loads secrets
        auth[context.authParam] = `ENV:${context.authEnvHint}`;
      }
    }

    const body: CreatePipelineBody = {
      name: pipelineName,
      sourceType: 'rest_api',
      destinationType: destination,
      tool: 'dlt',
      description: `${source.name} → ${destination} (${filteredResources.length} resources via dlthub context)`,
      sourceConfiguration: {
        advanced_config: JSON.stringify(advancedConfig),
        resource_name: filteredResources[0] ? (filteredResources[0] as { name: string }).name : 'data',
        base_url: context.baseUrl,
        _context_slug: context.slug,
        _context_url: context.contextUrl,
      },
    };

    setState((prev) => ({ ...prev, step: 'review', saving: true, saveError: null }));

    try {
      const res = await fetch('/api/elt/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json() as { pipeline?: { id?: string }; error?: string };
      if (!res.ok) throw new Error(data.error ?? 'Save failed');
      setState((prev) => ({ ...prev, saving: false, saved: true, savedId: data.pipeline?.id ?? null }));
      onPipelineSaved?.(pipelineName);
    } catch (e) {
      setState((prev) => ({
        ...prev,
        saving: false,
        saveError: e instanceof Error ? e.message : 'Save failed',
      }));
    }
  }, [state, onPipelineSaved]);

  const { step, source, context, contextLoading, contextError, selectedEndpoints, authValues, destination, pipelineName, saving, saved, savedId, saveError } = state;

  return (
    <div className="min-h-0">
      {/* Progress indicator */}
      {step !== 'browse' && (
        <div className="flex items-center gap-2 mb-5 text-xs text-slate-500">
          <span className="text-slate-400">Browse</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'configure' ? 'text-sky-600 font-medium' : step === 'review' ? 'text-slate-400' : 'text-slate-400'}>Configure</span>
          <ChevronRight className="h-3 w-3" />
          <span className={step === 'review' ? 'text-sky-600 font-medium' : 'text-slate-400'}>Review</span>
        </div>
      )}

      {step === 'browse' && (
        <BrowseStep onSelect={fetchContext} />
      )}

      {step === 'configure' && source && (
        <ConfigureStep
          source={source}
          context={context}
          loading={contextLoading}
          error={contextError}
          selectedEndpoints={selectedEndpoints}
          onToggleEndpoint={toggleEndpoint}
          onToggleAll={toggleAll}
          authValues={authValues}
          onAuthChange={(k, v) => setState((prev) => ({ ...prev, authValues: { ...prev.authValues, [k]: v } }))}
          destination={destination}
          onDestinationChange={(d) => setState((prev) => ({ ...prev, destination: d }))}
          pipelineName={pipelineName}
          onNameChange={(n) => setState((prev) => ({ ...prev, pipelineName: n }))}
          onBack={() => setState((prev) => ({ ...prev, step: 'browse' }))}
          onNext={() => setState((prev) => ({ ...prev, step: 'review' }))}
        />
      )}

      {step === 'review' && source && context && (
        <ReviewStep
          source={source}
          context={context}
          selectedEndpoints={selectedEndpoints}
          destination={destination}
          pipelineName={pipelineName}
          saving={saving}
          saved={saved}
          savedId={savedId}
          saveError={saveError}
          onBack={() => setState((prev) => ({ ...prev, step: 'configure' }))}
          onSave={savePipeline}
        />
      )}
    </div>
  );
}
