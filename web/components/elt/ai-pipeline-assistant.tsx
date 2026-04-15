'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Bot, X, Send, Sparkles, Maximize2, Minimize2, Zap, CheckCircle, Loader2, ChevronRight } from 'lucide-react';
import type { CreatePipelineBody } from '@/lib/elt/types';

interface Message {
  role: 'user' | 'assistant';
  content: string;
  savePayload?: CreatePipelineBody;
}

const STARTER_PROMPTS = [
  'Load GitHub issues and PRs into Snowflake',
  'Sync Stripe payments to BigQuery incrementally',
  'Pull HubSpot contacts into Postgres',
  'Connect a REST API to DuckDB',
  'Replicate a Postgres table to Redshift',
  'What sources do you support?',
];

const FOLLOW_UPS: Record<string, string[]> = {
  github: ['What resources can I load?', 'How do I set up incremental loading?', 'What env vars do I need?'],
  stripe: ['Can I load subscriptions too?', 'How far back can I backfill?', 'What is the start_date format?'],
  rest_api: ['How do I handle pagination?', 'What if my API needs OAuth?', 'Can I load multiple endpoints?'],
  database: ['Can I use CDC / replication?', 'How do I pick which tables to sync?', 'What destinations are supported?'],
  general: ['Show me all supported sources', 'What destinations are available?', 'How does incremental loading work?'],
};

function getFollowUps(text: string): string[] {
  const lower = text.toLowerCase();
  if (lower.includes('github')) return FOLLOW_UPS.github;
  if (lower.includes('stripe') || lower.includes('shopify') || lower.includes('hubspot')) return FOLLOW_UPS.stripe;
  if (lower.includes('rest') || lower.includes('api') || lower.includes('endpoint')) return FOLLOW_UPS.rest_api;
  if (lower.includes('postgres') || lower.includes('mysql') || lower.includes('database') || lower.includes('sling')) return FOLLOW_UPS.database;
  return FOLLOW_UPS.general;
}

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
        elements.push(
          <p key={`h3-${idx}`} className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-3 mb-0.5">
            {trimmed.slice(4)}
          </p>
        );
      } else if (trimmed.startsWith('## ')) {
        elements.push(
          <p key={`h2-${idx}`} className="text-sm font-bold text-white mt-2 mb-0.5">
            {trimmed.slice(3)}
          </p>
        );
      } else {
        elements.push(
          <p key={`p-${idx}`} className="text-sm text-slate-300 leading-relaxed">
            {renderInline(trimmed)}
          </p>
        );
      }
    }
  });
  flushList('list-final');
  return elements;
}

// ── Main component ────────────────────────────────────────────────────────────

export function AiPipelineAssistant({
  onPipelineSaved,
}: {
  onPipelineSaved?: (name: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [savingPayload, setSavingPayload] = useState<string | null>(null);
  const [savedNames, setSavedNames] = useState<Set<string>>(new Set());
  const scrollRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages, loading]);

  useEffect(() => {
    if (open && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 50);
    }
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
      const data = await res.json() as { message: string; savePayload?: CreatePipelineBody };
      setMessages((prev) => [...prev, { role: 'assistant', content: data.message, savePayload: data.savePayload }]);
    } catch {
      setMessages((prev) => [...prev, { role: 'assistant', content: 'Sorry, something went wrong. Please try again.' }]);
    } finally {
      setLoading(false);
    }
  }, [messages, loading]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      void sendMessage(input);
    }
  };

  const savePipeline = async (payload: CreatePipelineBody, msgIdx: number) => {
    const key = `${msgIdx}`;
    setSavingPayload(key);
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
      setSavedNames((prev) => { const next = new Set(prev); next.add(key); return next; });
      onPipelineSaved?.(payload.name);
      setMessages((prev) => [
        ...prev,
        {
          role: 'assistant',
          content: `Pipeline **${payload.name}** saved! You can find it in the [Pipelines](/builder) list. Head to [Run Slices](/run-slices) to configure incremental loading.`,
        },
      ]);
    } catch (e) {
      setMessages((prev) => [
        ...prev,
        { role: 'assistant', content: `Could not save pipeline: ${e instanceof Error ? e.message : 'unknown error'}` },
      ]);
    } finally {
      setSavingPayload(null);
    }
  };

  const lastMsg = messages[messages.length - 1];
  const followUps = lastMsg?.role === 'assistant' ? getFollowUps(lastMsg.content) : [];
  const panelW = expanded ? 'w-[720px]' : 'w-[420px]';
  const panelH = expanded ? 'h-[640px]' : 'h-[520px]';

  return (
    <>
      {/* Floating trigger button */}
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

      {/* Chat panel */}
      {open && (
        <div
          className={`fixed bottom-6 right-6 z-50 flex flex-col rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl transition-all ${panelW} ${panelH}`}
        >
          {/* Header */}
          <div className="flex items-center gap-2 border-b border-slate-800 px-4 py-3">
            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-gradient-to-br from-teal-500 to-sky-500">
              <Bot className="h-4 w-4 text-white" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-semibold text-white">AI Pipeline Builder</p>
              <p className="text-[11px] text-slate-400">Powered by Claude + dlt Hub</p>
            </div>
            <button
              onClick={() => setExpanded((v) => !v)}
              className="rounded p-1 text-slate-400 hover:text-white"
              title={expanded ? 'Collapse' : 'Expand'}
            >
              {expanded ? <Minimize2 className="h-4 w-4" /> : <Maximize2 className="h-4 w-4" />}
            </button>
            <button
              onClick={() => setOpen(false)}
              className="rounded p-1 text-slate-400 hover:text-white"
              title="Close"
            >
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
                    Hi! I can help you build ELT pipelines using dlt verified sources and Sling. Tell me what data you want to move — or pick a starter below.
                  </div>
                </div>
                <div className="flex flex-wrap gap-1.5 pl-8">
                  {STARTER_PROMPTS.map((p) => (
                    <button
                      key={p}
                      onClick={() => void sendMessage(p)}
                      className="rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-300 hover:border-teal-500 hover:text-teal-300 transition-colors"
                    >
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
                <div
                  className={`max-w-[85%] rounded-xl px-3 py-2.5 ${
                    msg.role === 'user'
                      ? 'rounded-tr-none bg-teal-700 text-white text-sm'
                      : 'rounded-tl-none bg-slate-800 text-slate-200'
                  }`}
                >
                  {msg.role === 'user' ? (
                    <p className="text-sm">{msg.content}</p>
                  ) : (
                    renderContent(msg.content)
                  )}

                  {/* Save pipeline button */}
                  {msg.role === 'assistant' && msg.savePayload && (
                    <div className="mt-2.5 pt-2.5 border-t border-slate-700">
                      {savedNames.has(`${idx}`) ? (
                        <div className="flex items-center gap-1.5 text-teal-400 text-xs font-medium">
                          <CheckCircle className="h-3.5 w-3.5" />
                          Pipeline saved!
                        </div>
                      ) : (
                        <button
                          onClick={() => void savePipeline(msg.savePayload!, idx)}
                          disabled={savingPayload === `${idx}`}
                          className="flex items-center gap-1.5 rounded-lg bg-teal-600 px-3 py-1.5 text-xs font-semibold text-white hover:bg-teal-500 disabled:opacity-60 transition-colors"
                        >
                          {savingPayload === `${idx}` ? (
                            <Loader2 className="h-3.5 w-3.5 animate-spin" />
                          ) : (
                            <Zap className="h-3.5 w-3.5" />
                          )}
                          Save pipeline &quot;{msg.savePayload.name}&quot;
                        </button>
                      )}
                    </div>
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

          {/* Follow-up suggestions */}
          {followUps.length > 0 && !loading && (
            <div className="flex flex-wrap gap-1.5 border-t border-slate-800 px-4 py-2">
              {followUps.map((f) => (
                <button
                  key={f}
                  onClick={() => void sendMessage(f)}
                  className="flex items-center gap-1 rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] text-slate-400 hover:border-teal-600 hover:text-teal-300 transition-colors"
                >
                  <ChevronRight className="h-3 w-3" />
                  {f}
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
