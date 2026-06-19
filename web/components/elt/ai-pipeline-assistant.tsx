'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import clsx from 'clsx';
import {
  Bot, X, Send, Sparkles, Maximize2, Minimize2,
  Zap, CheckCircle, Loader2, ChevronRight, ExternalLink, PenLine, Code2, ChevronDown,
} from 'lucide-react';
import type { CreatePipelineBody } from '@/lib/elt/types';
import type { InlineField, PatchPipelinePayload } from '@/app/api/elt/ai-assistant/route';
import { useWorkspacePermissions } from '@/lib/hooks/use-workspace-permissions';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  savePayload?: CreatePipelineBody;
  patchPayload?: PatchPipelinePayload;
  patchPipelineId?: string;
  requiredFields?: InlineField[];
  codePreview?: string;
  componentSummary?: string[];
}

const STARTER_PROMPTS = [
  'Load GitHub issues and PRs into Snowflake',
  'GitHub → Snowflake with S3 file sensor and not-null checks on issues.id',
  'Sync Stripe payments to BigQuery with dbt staging',
  'Pull HubSpot contacts into Postgres',
  'Connect a REST API to DuckDB',
  'Replicate a Postgres table to Redshift',
  'GitHub → Snowflake EL+T with dbt models after load',
  'What workspace dbt projects do I have?',
];

const CANVAS_STARTER_PROMPTS = [
  'Build medallion layers on one ingested table — cleanse, dedupe, gold rollup',
  'Single source to curated mart — filter, project, aggregate',
  'Entity 360 profile — join dimension and roll up metrics',
  'Build a SaaS ingest pipeline with filter active rows and DQ on id',
  'Join loaded data to a customers dimension table',
  'Clean strings, parse created_at dates, and dedupe by id',
  'Group by date and sum amount after load',
  'Find orphan rows with anti-join against reference table',
  'Union two sources and roll up daily metrics',
];

const FOLLOW_UPS = [
  'Show me all supported sources',
  'What destinations are available?',
  'How does incremental loading work?',
  'Sync Stripe payments to BigQuery',
  'Pull HubSpot contacts into Postgres',
];

// ── Markdown renderer ─────────────────────────────────────────────────────────

function renderInline(text: string): React.ReactNode {
  const parts = text.split(/(`[^`]+`|\*\*[^*]+\*\*|\*[^*]+\*)/g);
  return parts.map((part, i) => {
    if (part.startsWith('**') && part.endsWith('**'))
      return <strong key={i} className="font-semibold text-white">{part.slice(2, -2)}</strong>;
    if (part.startsWith('*') && part.endsWith('*'))
      return <em key={i}>{part.slice(1, -1)}</em>;
    if (part.startsWith('`') && part.endsWith('`'))
      return <code key={i} className="bg-slate-700 rounded px-1 text-[11px] font-mono text-teal-300">{part.slice(1, -1)}</code>;
    return part;
  });
}

function renderContent(text: string): React.ReactNode[] {
  const lines = text.split('\n');
  const elements: React.ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = (key: string) => {
    if (listItems.length > 0) {
      elements.push(
        <ul key={key} className="list-disc list-inside space-y-0.5 my-1 pl-1">
          {listItems.map((item, i) => (
            <li key={i} className="text-sm text-slate-300">{renderInline(item)}</li>
          ))}
        </ul>
      );
      listItems = [];
    }
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      listItems.push(trimmed.slice(2));
    } else {
      flushList(`list-${idx}`);
      if (trimmed === '') {
        elements.push(<div key={`br-${idx}`} className="h-1" />);
      } else if (trimmed.startsWith('### ')) {
        elements.push(<p key={`h3-${idx}`} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-3 mb-0.5">{trimmed.slice(4)}</p>);
      } else if (trimmed.startsWith('## ')) {
        elements.push(<p key={`h2-${idx}`} className="text-sm font-bold text-white mt-2 mb-0.5">{trimmed.slice(3)}</p>);
      } else {
        elements.push(<p key={`p-${idx}`} className="text-sm text-slate-300 leading-relaxed">{renderInline(trimmed)}</p>);
      }
    }
  });
  flushList('list-final');
  return elements;
}

// ── Inline config form ────────────────────────────────────────────────────────

function InlineConfigForm({
  fields,
  payload,
  onSave,
  onSkip,
  saving,
  saved,
}: {
  fields: InlineField[];
  payload: CreatePipelineBody;
  onSave: (patched: CreatePipelineBody) => void;
  onSkip: () => void;
  saving: boolean;
  saved: boolean;
}) {
  const [values, setValues] = useState<Record<string, string>>(() => {
    const initial: Record<string, string> = {};
    for (const f of fields) {
      initial[f.key] = String((payload.sourceConfiguration ?? {})[f.key] ?? '');
    }
    return initial;
  });

  const handleSave = () => {
    const patched: CreatePipelineBody = {
      ...payload,
      sourceConfiguration: {
        ...(payload.sourceConfiguration ?? {}),
        ...Object.fromEntries(
          fields
            .filter((f) => values[f.key]?.trim())
            .map((f) => [f.key, values[f.key].trim()])
        ),
      },
    };
    onSave(patched);
  };

  if (saved) {
    return (
      <div className="flex items-center gap-1.5 text-teal-400 text-xs font-medium mt-2">
        <CheckCircle className="h-3.5 w-3.5" /> Pipeline saved and configured!
      </div>
    );
  }

  return (
    <div className="mt-2.5 space-y-2 rounded-lg border border-slate-600 bg-slate-900 p-3">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide">Configure now</p>
      {fields.map((f) => (
        <label key={f.key} className="block">
          <span className="text-[11px] text-slate-400">{f.label}</span>
          {f.help && <span className="ml-1 text-[10px] text-slate-600">({f.help})</span>}
          <input
            type={f.type === 'password' ? 'password' : 'text'}
            value={values[f.key] ?? ''}
            onChange={(e) => setValues((v) => ({ ...v, [f.key]: e.target.value }))}
            placeholder={f.placeholder}
            autoComplete="off"
            className="mt-0.5 w-full rounded-md border border-slate-700 bg-slate-800 px-2 py-1.5 text-xs text-white placeholder-slate-600 outline-none focus:border-teal-600"
          />
        </label>
      ))}
      <div className="flex gap-2 pt-1">
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex flex-1 items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60 transition-colors"
        >
          {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Save pipeline
        </button>
        <button
          onClick={onSkip}
          className="flex items-center gap-1 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white transition-colors"
        >
          Skip — fill in builder
        </button>
      </div>
    </div>
  );
}

// ── Code preview panel (human-in-the-loop review before save) ─────────────────

function CodePreviewPanel({ code }: { code: string }) {
  const [open, setOpen] = useState(false);
  return (
    <div className="mt-2 rounded-lg border border-slate-700 bg-slate-950">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex w-full items-center gap-1.5 px-3 py-1.5 text-[11px] text-slate-400 hover:text-slate-200 transition-colors"
      >
        <Code2 className="h-3 w-3" />
        <span className="flex-1 text-left">Review generated code</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <pre className="max-h-48 overflow-y-auto border-t border-slate-700 px-3 py-2 text-[10px] leading-relaxed text-teal-300 whitespace-pre-wrap break-all">
          {code}
        </pre>
      )}
    </div>
  );
}

// ── Save actions shown on generated pipeline ──────────────────────────────────

function PipelineActions({
  msg,
  msgIdx,
  savingKey,
  savedKeys,
  onSaveWithPayload,
  onPatchPipeline,
  onOpenBuilder,
  onOpenCanvas,
}: {
  msg: Message;
  msgIdx: number;
  savingKey: string | null;
  savedKeys: Set<string>;
  onSaveWithPayload: (payload: CreatePipelineBody, key: string) => Promise<void>;
  onPatchPipeline: (pipelineId: string, patch: PatchPipelinePayload, key: string) => Promise<void>;
  onOpenBuilder: (pipelineId?: string) => void;
  onOpenCanvas: (pipelineId?: string) => void;
}) {
  const [reviewed, setReviewed] = useState(false);
  const [mode, setMode] = useState<'buttons' | 'inline'>('buttons');
  const key = `${msgIdx}`;
  const isSaving = savingKey === key;
  const isSaved = savedKeys.has(key);

  if (msg.patchPayload && msg.patchPipelineId) {
    if (isSaved) {
      return (
        <div className="mt-2.5 pt-2.5 border-t border-slate-700 flex flex-wrap items-center gap-2">
          <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
          <span className="text-xs text-teal-400 font-medium">Applied to canvas!</span>
        </div>
      );
    }
    return (
      <div className="mt-2.5 pt-2.5 border-t border-slate-700">
        {msg.componentSummary?.length ? (
          <p className="mb-2 text-[11px] text-slate-400">
            Components: <span className="text-teal-300">{msg.componentSummary.join(', ')}</span>
          </p>
        ) : null}
        <button
          onClick={() => void onPatchPipeline(msg.patchPipelineId!, msg.patchPayload!, key)}
          disabled={isSaving}
          className="flex w-full items-center justify-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60 transition-colors"
        >
          {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
          Apply to canvas
        </button>
      </div>
    );
  }

  if (!msg.savePayload) return null;

  if (isSaved || savedKeys.has(`${key}-skip`)) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-slate-700 flex flex-wrap items-center gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
        <span className="text-xs text-teal-400 font-medium">Saved!</span>
        <button
          onClick={() => onOpenBuilder()}
          className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Form builder
        </button>
        <button
          onClick={() => onOpenCanvas()}
          className="flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Canvas
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-700">
      {msg.componentSummary?.length ? (
        <p className="mb-2 text-[11px] text-slate-400">
          Canvas components: <span className="text-teal-300">{msg.componentSummary.join(', ')}</span>
        </p>
      ) : null}
      {/* Code preview — always shown so user can review before saving */}
      {msg.codePreview && (
        <CodePreviewPanel code={msg.codePreview} />
      )}

      {/* Confirmation gate: require "looks good" before showing save buttons */}
      {msg.codePreview && !reviewed && (
        <button
          onClick={() => setReviewed(true)}
          className="mt-2 w-full flex items-center justify-center gap-1.5 rounded-lg border border-teal-700 px-3 py-1.5 text-xs text-teal-400 hover:bg-teal-900/40 hover:text-teal-300 transition-colors"
        >
          <CheckCircle className="h-3.5 w-3.5" /> Looks good — show save options
        </button>
      )}

      {(!msg.codePreview || reviewed) && (mode === 'buttons' ? (
        <div className="flex flex-col gap-2">
          {/* Primary: configure inline if fields exist */}
          {msg.requiredFields && msg.requiredFields.length > 0 ? (
            <button
              onClick={() => setMode('inline')}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 transition-colors"
            >
              <PenLine className="h-3.5 w-3.5" />
              Configure &amp; save &quot;{msg.savePayload.name}&quot;
            </button>
          ) : (
            <button
              onClick={() => void onSaveWithPayload(msg.savePayload!, key)}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60 transition-colors"
            >
              {isSaving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Zap className="h-3.5 w-3.5" />}
              Save &quot;{msg.savePayload.name}&quot;
            </button>
          )}
          {/* Secondary: save with placeholders and open builder */}
          {msg.requiredFields && msg.requiredFields.length > 0 && (
            <button
              onClick={async () => {
                await onSaveWithPayload(msg.savePayload!, `${key}-skip`);
                onOpenBuilder();
              }}
              disabled={isSaving}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 px-3 py-1.5 text-xs text-slate-400 hover:text-white hover:border-slate-500 transition-colors"
            >
              <ExternalLink className="h-3 w-3" />
              Save &amp; configure in builder
            </button>
          )}
        </div>
      ) : (
        <InlineConfigForm
          fields={msg.requiredFields ?? []}
          payload={msg.savePayload}
          onSave={(patched) => void onSaveWithPayload(patched, key)}
          onSkip={async () => {
            await onSaveWithPayload(msg.savePayload!, `${key}-skip`);
            onOpenBuilder();
          }}
          saving={isSaving}
          saved={isSaved}
        />
      ))}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AiPipelineAssistant({
  onPipelineSaved,
  onPipelinePatched,
  inline = false,
  pipelineId,
  canvasMode = false,
}: {
  onPipelineSaved?: (name: string) => void;
  onPipelinePatched?: () => void;
  inline?: boolean;
  /** When set, AI can add components to this pipeline via add_pipeline_components. */
  pipelineId?: string;
  /** Canvas sidebar styling and edit-mode starter prompts. */
  canvasMode?: boolean;
}) {
  const router = useRouter();
  const { permissions, loading: permsLoading } = useWorkspacePermissions();
  const canWrite = permissions?.canWrite ?? true;
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingKey, setSavingKey] = useState<string | null>(null);
  const [savedKeys, setSavedKeys] = useState<Set<string>>(new Set());
  const [savedPipelineId, setSavedPipelineId] = useState<string | undefined>();
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
  }, [messages, loading]);

  useEffect(() => {
    if (open && textareaRef.current) setTimeout(() => textareaRef.current?.focus(), 50);
  }, [open]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || loading || !canWrite) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/elt/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messages: next.map((m) => ({ role: m.role, content: m.content })),
          ...(pipelineId ? { pipelineId } : {}),
        }),
      });
      if (!res.ok) throw new Error('Assistant request failed');
      const data = await res.json() as {
        message: string;
        savePayload?: CreatePipelineBody;
        patchPayload?: PatchPipelinePayload;
        patchPipelineId?: string;
        requiredFields?: InlineField[];
        codePreview?: string;
        componentSummary?: string[];
      };
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message,
        savePayload: data.savePayload,
        patchPayload: data.patchPayload,
        patchPipelineId: data.patchPipelineId,
        requiredFields: data.requiredFields,
        codePreview: data.codePreview,
        componentSummary: data.componentSummary,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading, canWrite, pipelineId]);

  const patchPipeline = useCallback(async (id: string, patch: PatchPipelinePayload, key: string) => {
    if (!canWrite) return;
    setSavingKey(key);
    try {
      const res = await fetch(`/api/elt/pipelines/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(patch),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string; errors?: string[] };
        const detail = Array.isArray(err.errors) && err.errors.length ? err.errors.join(' ') : err.error;
        throw new Error(detail ?? 'Apply failed');
      }
      setSavedKeys((prev) => { const next = new Set(prev); next.add(key); return next; });
      onPipelinePatched?.();
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Could not apply to canvas: ${e instanceof Error ? e.message : 'unknown error'}`,
      }]);
    } finally {
      setSavingKey(null);
    }
  }, [canWrite, onPipelinePatched]);

  const savePipeline = useCallback(async (payload: CreatePipelineBody, key: string) => {
    if (!canWrite) return;
    setSavingKey(key);
    try {
      const res = await fetch('/api/elt/pipelines', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const err = await res.json() as { error?: string };
        throw new Error(err.error ?? 'Save failed');
      }
      const data = await res.json() as { pipeline?: { id?: string } };
      setSavedPipelineId(data.pipeline?.id);
      setSavedKeys((prev) => { const next = new Set(prev); next.add(key); return next; });
      onPipelineSaved?.(payload.name);
    } catch (e) {
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: `Could not save pipeline: ${e instanceof Error ? e.message : 'unknown error'}`,
      }]);
    } finally {
      setSavingKey(null);
    }
  }, [onPipelineSaved, canWrite]);

  const openBuilder = useCallback((id?: string) => {
    const target = id ?? savedPipelineId;
    router.push(target ? `/builder?pipeline=${encodeURIComponent(target)}` : '/builder');
  }, [router, savedPipelineId]);

  const openCanvas = useCallback((id?: string) => {
    const target = id ?? savedPipelineId;
    router.push(target ? `/builder/canvas?pipeline=${encodeURIComponent(target)}` : '/builder/canvas');
  }, [router, savedPipelineId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  };

  const lastMsg = messages[messages.length - 1];
  const showFollowUps = lastMsg?.role === 'assistant' && !lastMsg.savePayload && !lastMsg.patchPayload && !loading;
  const starterPrompts = canvasMode ? CANVAS_STARTER_PROMPTS : STARTER_PROMPTS;
  const emptyHint = canvasMode
    ? 'Describe components to add — sensors, quality checks, transforms…'
    : 'Describe the pipeline you want to build…';
  const welcomeHint = canvasMode
    ? 'Tell me what to add to this pipeline — monitors, checks, or transforms. Or pick a starter below.'
    : 'Tell me what data you want to move and I\'ll build the pipeline. Or pick a starter below.';
  const panelW = expanded ? 'w-[480px]' : 'w-[420px]';
  const panelH = expanded ? 'h-[680px]' : 'h-[520px]';

  const readOnlyBanner = !permsLoading && permissions && !canWrite ? (
    <div className="mb-3 rounded-lg border border-slate-300 bg-slate-100 px-3 py-2 text-xs text-slate-700 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-200">
      Read-only role ({permissions.role}) — you can ask questions about connectors and catalog, but saving pipelines requires a member invite.
    </div>
  ) : null;

  // ── Inline variant: embedded in the builder page ─────────────────────────────
  if (inline) {
    return (
      <div className={clsx('flex flex-col', canvasMode ? 'h-[320px]' : '')} style={canvasMode ? undefined : { height: '420px' }}>
        {readOnlyBanner}
        <div ref={scrollRef} className="flex-1 overflow-y-auto space-y-3 pr-1">
          {messages.length === 0 && (
            <div className="space-y-3">
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className={clsx(
                  'rounded-xl rounded-tl-none px-3 py-2.5 text-sm',
                  canvasMode
                    ? 'bg-slate-100 border border-slate-200 text-slate-700 dark:bg-slate-800 dark:border-slate-700 dark:text-slate-200'
                    : 'bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-700 dark:text-slate-200'
                )}>
                  {welcomeHint}
                </div>
              </div>
              <div className="flex flex-wrap gap-1.5 pl-8">
                {starterPrompts.map((p) => (
                  <button key={p} onClick={() => void sendMessage(p)} className="rounded-full border border-teal-200 bg-teal-50 px-2.5 py-1 text-[11px] text-teal-700 hover:border-teal-400 hover:bg-teal-100 dark:border-teal-700 dark:bg-teal-900/20 dark:text-teal-300 transition-colors">
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((msg, idx) => (
            <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
              {msg.role === 'assistant' && (
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
              )}
              <div className={`max-w-[88%] rounded-xl px-3 py-2.5 ${msg.role === 'user' ? 'rounded-tr-none bg-teal-600 text-white text-sm' : 'rounded-tl-none bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 text-slate-800 dark:text-slate-200'}`}>
                {msg.role === 'user' ? (
                  <p className="text-sm">{msg.content}</p>
                ) : (
                  <>
                    {renderContent(msg.content)}
                    <PipelineActions msg={msg} msgIdx={idx} savingKey={savingKey} savedKeys={savedKeys} onSaveWithPayload={savePipeline} onPatchPipeline={patchPipeline} onOpenBuilder={openBuilder} onOpenCanvas={openCanvas} />
                  </>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex items-start gap-2">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                <Bot className="h-3.5 w-3.5 text-white" />
              </div>
              <div className="rounded-xl rounded-tl-none bg-white border border-slate-200 dark:bg-slate-800 dark:border-slate-700 px-3 py-2.5">
                <div className="flex gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 rounded-full bg-slate-400 animate-bounce" style={{ animationDelay: '300ms' }} />
                </div>
              </div>
            </div>
          )}
        </div>
        <div className="mt-3 flex items-end gap-2 rounded-xl border border-slate-300 bg-white dark:border-slate-600 dark:bg-slate-800 px-3 py-2 focus-within:border-teal-500 dark:focus-within:border-teal-600">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={emptyHint}
            rows={2}
            className="flex-1 resize-none bg-transparent text-sm text-slate-800 dark:text-white placeholder-slate-400 outline-none"
          />
          <button
            onClick={() => void sendMessage(input)}
            disabled={!input.trim() || loading || !canWrite}
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors"
          >
            <Send className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    );
  }

  // ── Floating widget variant ───────────────────────────────────────────────────
  return (
    <>
      {!open && (
        <button
          onClick={() => setOpen(true)}
          className="fixed bottom-6 right-6 z-50 flex items-center gap-2 rounded-full bg-gradient-to-r from-teal-500 to-sky-500 px-4 py-3 text-sm font-semibold text-white shadow-lg hover:from-teal-400 hover:to-sky-400 transition-all"
          title="AI Pipeline Builder"
        >
          <Sparkles className="h-4 w-4" />
          <span>AI Builder</span>
        </button>
      )}

      {open && (
        <div className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transition-all ${panelW} ${panelH}`}>
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">AI Pipeline Builder</p>
              <p className="text-[11px] text-slate-400">Powered by Claude · eltPulse</p>
            </div>
            <button onClick={() => setExpanded((v) => !v)} className="rounded p-1 text-slate-400 hover:text-white" title={expanded ? 'Collapse' : 'Expand'}>
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button onClick={() => setOpen(false)} className="rounded p-1 text-slate-400 hover:text-white" title="Close">
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
            {readOnlyBanner}
            {messages.length === 0 && (
              <div className="space-y-3">
                <div className="flex items-start gap-2">
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                  <div className="rounded-xl rounded-tl-none bg-slate-800 px-3 py-2.5 text-sm text-slate-200">
                    Tell me what data you want to move and I&apos;ll build the pipeline. Or pick a starter below.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-8">
                  {STARTER_PROMPTS.map((p) => (
                    <button key={p} onClick={() => void sendMessage(p)} className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500 hover:text-teal-300 transition-colors">
                      {p}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {messages.map((msg, idx) => (
              <div key={idx} className={`flex items-start gap-2 ${msg.role === 'user' ? 'flex-row-reverse' : ''}`}>
                {msg.role === 'assistant' && (
                  <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                    <Bot className="h-3.5 w-3.5 text-white" />
                  </div>
                )}
                <div className={`max-w-[88%] rounded-xl px-3 py-2.5 ${msg.role === 'user' ? 'rounded-tr-none bg-teal-700 text-white text-sm' : 'rounded-tl-none bg-slate-800 text-slate-200'}`}>
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    <>
                      {renderContent(msg.content)}
                      <PipelineActions
                        msg={msg}
                        msgIdx={idx}
                        savingKey={savingKey}
                        savedKeys={savedKeys}
                        onSaveWithPayload={savePipeline}
                        onPatchPipeline={patchPipeline}
                        onOpenBuilder={openBuilder}
                        onOpenCanvas={openCanvas}
                      />
                    </>
                  )}
                </div>
              </div>
            ))}

            {loading && (
              <div className="flex items-start gap-2">
                <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
                  <Bot className="h-3.5 w-3.5 text-white" />
                </div>
                <div className="rounded-xl rounded-tl-none bg-slate-800 px-3 py-2.5">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '150ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-slate-500 animate-bounce" style={{ animationDelay: '300ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Follow-up chips — only for informational responses */}
          {showFollowUps && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-800 px-4 py-2">
              {FOLLOW_UPS.map((f) => (
                <button key={f} onClick={() => void sendMessage(f)} className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:border-teal-600 hover:text-teal-300 transition-colors">
                  <ChevronRight className="h-3 w-3" />{f}
                </button>
              ))}
            </div>
          )}

          {/* Input */}
          <div className="border-t border-slate-800 p-3">
            <div className="flex items-end gap-2 rounded-xl border border-slate-700 bg-slate-800 px-3 py-2 focus-within:border-teal-600">
              <textarea
                ref={textareaRef}
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder="Describe the pipeline you want to build…"
                rows={2}
                className="flex-1 resize-none bg-transparent text-sm text-white placeholder-slate-500 outline-none"
              />
              <button
                onClick={() => void sendMessage(input)}
                disabled={!input.trim() || loading || !canWrite}
                className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-40 transition-colors"
              >
                <Send className="h-3.5 w-3.5" />
              </button>
            </div>
            <p className="mt-1.5 text-center text-[10px] text-slate-600">Enter to send · Shift+Enter for new line</p>
          </div>
        </div>
      )}
    </>
  );
}
