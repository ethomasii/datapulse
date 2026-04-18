'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  Bot, X, Send, Sparkles, Maximize2, Minimize2,
  Zap, CheckCircle, Loader2, ChevronRight, ExternalLink, PenLine,
} from 'lucide-react';
import type { CreatePipelineBody } from '@/lib/elt/types';
import type { InlineField } from '@/app/api/elt/ai-assistant/route';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  savePayload?: CreatePipelineBody;
  requiredFields?: InlineField[];
}

const STARTER_PROMPTS = [
  'Load GitHub issues and PRs into Snowflake',
  'Sync Stripe payments to BigQuery incrementally',
  'Pull HubSpot contacts into Postgres',
  'Connect a REST API to DuckDB',
  'Replicate a Postgres table to Redshift',
  'What sources do you support?',
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

// ── Save actions shown on generated pipeline ──────────────────────────────────

function PipelineActions({
  msg,
  msgIdx,
  savingKey,
  savedKeys,
  onSaveWithPayload,
  onOpenBuilder,
}: {
  msg: Message;
  msgIdx: number;
  savingKey: string | null;
  savedKeys: Set<string>;
  onSaveWithPayload: (payload: CreatePipelineBody, key: string) => Promise<void>;
  onOpenBuilder: (pipelineId?: string) => void;
}) {
  const [mode, setMode] = useState<'buttons' | 'inline'>('buttons');
  const key = `${msgIdx}`;
  const isSaving = savingKey === key;
  const isSaved = savedKeys.has(key);
  const savedWithPlaceholders = savedKeys.has(`${key}-skip`);

  if (!msg.savePayload) return null;

  if (isSaved || savedWithPlaceholders) {
    return (
      <div className="mt-2.5 pt-2.5 border-t border-slate-700 flex items-center gap-2">
        <CheckCircle className="h-3.5 w-3.5 text-teal-400" />
        <span className="text-xs text-teal-400 font-medium">Saved!</span>
        <button
          onClick={() => onOpenBuilder()}
          className="ml-auto flex items-center gap-1 text-[11px] text-slate-400 hover:text-white transition-colors"
        >
          <ExternalLink className="h-3 w-3" /> Open in builder
        </button>
      </div>
    );
  }

  return (
    <div className="mt-2.5 pt-2.5 border-t border-slate-700">
      {mode === 'buttons' ? (
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
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export function AiPipelineAssistant({ onPipelineSaved }: { onPipelineSaved?: (name: string) => void }) {
  const router = useRouter();
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
    if (!text.trim() || loading) return;
    const userMsg: Message = { role: 'user', content: text.trim() };
    const next = [...messages, userMsg];
    setMessages(next);
    setInput('');
    setLoading(true);
    try {
      const res = await fetch('/api/elt/ai-assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ messages: next.map((m) => ({ role: m.role, content: m.content })) }),
      });
      if (!res.ok) throw new Error('Assistant request failed');
      const data = await res.json() as { message: string; savePayload?: CreatePipelineBody; requiredFields?: InlineField[] };
      setMessages((prev) => [...prev, {
        role: 'assistant',
        content: data.message,
        savePayload: data.savePayload,
        requiredFields: data.requiredFields,
      }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const savePipeline = useCallback(async (payload: CreatePipelineBody, key: string) => {
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
  }, [onPipelineSaved]);

  const openBuilder = useCallback((id?: string) => {
    const target = id ?? savedPipelineId;
    router.push(target ? `/builder?pipeline=${encodeURIComponent(target)}` : '/builder');
  }, [router, savedPipelineId]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); void sendMessage(input); }
  };

  const lastMsg = messages[messages.length - 1];
  const showFollowUps = lastMsg?.role === 'assistant' && !lastMsg.savePayload && !loading;
  const panelW = expanded ? 'w-[480px]' : 'w-[420px]';
  const panelH = expanded ? 'h-[680px]' : 'h-[520px]';

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
                        onOpenBuilder={openBuilder}
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
                disabled={!input.trim() || loading}
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
