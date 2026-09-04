'use client';

import { useState, useRef, useEffect } from 'react';
import ReactMarkdown from 'react-markdown';

interface ChatAgentProps { runId: string | null; }

interface ToolCall { name: string; result: any; }
interface Message {
  id: string;
  role: 'user' | 'agent';
  content: string;
  toolCalls?: ToolCall[];
}

const SUGGESTED = [
  'What is the match rate for this run?',
  'Show me all fee mismatch exceptions',
  'Which transactions are unmatched?',
];

export function ChatAgent({ runId }: ChatAgentProps) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: '0',
      role: 'agent',
      content: 'Welcome to TaalMel AI Copilot. I have instant access to your active reconciliation batch — match rates, audit evidence, exception details, and individual transaction lookup. How can I assist you?',
    },
  ]);
  const [input,     setInput]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const [showTools, setShowTools] = useState<Record<string, boolean>>({});
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const send = async (text = input) => {
    const q = text.trim();
    if (!q) return;

    setInput('');
    setMessages(prev => [...prev, { id: Date.now().toString(), role: 'user', content: q }]);
    setLoading(true);

    try {
      const res = await fetch('/api/agent/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ query: q, runId }),
      });
      const data = await res.json();
      setMessages(prev => [...prev, {
        id: (Date.now() + 1).toString(),
        role: 'agent',
        content: data.answer || data.error || 'No response.',
        toolCalls: data.toolCalls,
      }]);
    } catch {
      setMessages(prev => [...prev, { id: (Date.now() + 1).toString(), role: 'agent', content: 'Request failed. Check network or API key.' }]);
    } finally {
      setLoading(false);
    }
  };

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-2xl p-8 max-w-xl mx-auto my-8 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl bg-indigo-50 text-indigo-600 flex items-center justify-center mb-4 border border-indigo-100 shadow-sm">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800">TaalMel AI Copilot Inactive</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Run a reconciliation batch first in the <strong className="text-slate-700">Upload & Run</strong> tab to enable natural language queries.
        </p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-white border rounded-2xl overflow-hidden shadow-sm max-w-5xl mx-auto"
      style={{ height: 'calc(100vh - 120px)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div className="px-5 py-3.5 border-b flex items-center justify-between shrink-0 bg-slate-900 text-white">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center text-white shadow-xs">
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-bold tracking-tight">TaalMel AI Copilot</p>
            <p className="text-[10px] text-slate-400 font-mono">Run: {runId.slice(0, 14)}…</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <span className="flex items-center gap-1.5 text-[11px] font-semibold text-emerald-400 bg-emerald-950/80 px-2.5 py-1 rounded-full border border-emerald-800">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            Active
          </span>
        </div>
      </div>

      {/* Messages Feed */}
      <div className="flex-1 overflow-y-auto px-5 py-4 space-y-4 bg-slate-50/40">
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div style={{ maxWidth: '82%' }}>
              {/* Role label */}
              <div className={`text-[10px] mb-1 font-semibold ${msg.role === 'user' ? 'text-right text-slate-500' : 'text-indigo-600'}`}>
                {msg.role === 'user' ? 'You' : 'TaalMel AI Copilot'}
              </div>

              {/* Bubble */}
              <div
                className="px-4 py-3 rounded-2xl text-xs leading-relaxed shadow-xs overflow-hidden"
                style={
                  msg.role === 'user'
                    ? { background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', color: '#fff' }
                    : { background: '#fff', color: '#0f172a', border: '1px solid #e2e8f0' }
                }
              >
                {msg.role === 'user' ? (
                  <span className="whitespace-pre-wrap">{msg.content}</span>
                ) : (
                  <div className="prose prose-xs max-w-none dark:prose-invert prose-p:my-1 prose-ul:my-1.5 prose-ol:my-1.5 prose-li:my-0.5 prose-strong:font-bold prose-strong:text-slate-900">
                    <ReactMarkdown>{msg.content}</ReactMarkdown>
                  </div>
                )}
              </div>

              {/* Tool calls accordion */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-2 border rounded-xl overflow-hidden text-xs shadow-2xs" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => setShowTools(p => ({ ...p, [msg.id]: !p[msg.id] }))}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left font-bold transition-colors bg-slate-100/90 text-slate-700"
                  >
                    <svg className="w-3.5 h-3.5 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                    </svg>
                    <span>Executed {msg.toolCalls.length} DB tool query</span>
                    <svg className={`w-3 h-3 ml-auto transition-transform ${showTools[msg.id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showTools[msg.id] && (
                    <div className="divide-y bg-white" style={{ borderColor: 'var(--border)' }}>
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} className="p-3 font-mono text-[11px]">
                          <div className="font-bold text-slate-800 mb-1">{tc.name}()</div>
                          <pre className="p-2 rounded bg-slate-900 text-emerald-400 whitespace-pre-wrap break-all text-[10px]">
                            {typeof tc.result === 'object' ? JSON.stringify(tc.result, null, 2) : String(tc.result)}
                          </pre>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="px-4 py-3 rounded-2xl bg-white border border-slate-200 text-xs shadow-2xs">
              <div className="flex items-center gap-2 text-slate-500 font-semibold">
                <span className="w-2 h-2 rounded-full bg-blue-600 animate-ping" />
                <span>TaalMel AI is searching DB tools…</span>
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested Chips */}
      {messages.length < 3 && (
        <div className="px-5 py-2.5 flex gap-2 overflow-x-auto shrink-0 border-t bg-slate-100/70" style={{ borderColor: 'var(--border)' }}>
          {SUGGESTED.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded-full border transition-all font-semibold bg-white text-blue-700 border-blue-200 hover:bg-blue-50 shadow-2xs whitespace-nowrap"
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input Form */}
      <div className="p-4 border-t shrink-0 bg-white" style={{ borderColor: 'var(--border)' }}>
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about match rates, specific UTRs, exceptions, or journal proposals…"
            disabled={loading}
            className="flex-1 px-4 py-2.5 rounded-xl border text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/20 bg-slate-50 focus:bg-white transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-5 py-2.5 rounded-xl text-xs font-bold text-white transition-all bg-blue-600 hover:bg-blue-700 disabled:opacity-40 shadow-sm flex items-center gap-1.5"
          >
            <span>Send</span>
            <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7-7m7-7H3" />
            </svg>
          </button>
        </form>
      </div>
    </div>
  );
}
