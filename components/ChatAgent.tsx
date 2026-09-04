'use client';

import { useState, useRef, useEffect } from 'react';

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
      content: 'Connected. I can query the reconciliation data for this run — match rates, exception details, and specific transactions. What would you like to know?',
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
      <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-10 h-10 mb-3 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 8.511c.884.284 1.5 1.128 1.5 2.097v4.286c0 1.136-.847 2.1-1.98 2.193-.34.027-.68.052-1.02.072v3.091l-3-3c-1.354 0-2.694-.055-4.02-.163a2.115 2.115 0 01-.825-.242m9.345-8.334a2.126 2.126 0 00-.476-.095 48.64 48.64 0 00-8.048 0c-1.131.094-1.976 1.057-1.976 2.192v4.286c0 .837.46 1.58 1.155 1.951m9.345-8.334V6.637c0-1.621-1.152-3.026-2.76-3.235A48.455 48.455 0 0011.25 3c-2.115 0-4.198.137-6.24.402-1.608.209-2.76 1.614-2.76 3.235v6.226c0 1.621 1.152 3.026 2.76 3.235.577.075 1.157.14 1.74.194V21l4.155-4.155" />
        </svg>
        <p className="text-sm font-medium text-slate-500">Query assistant inactive</p>
        <p className="text-xs mt-1">Run a reconciliation first to enable queries.</p>
      </div>
    );
  }

  return (
    <div
      className="flex flex-col bg-white border rounded-lg overflow-hidden"
      style={{ height: 'calc(100vh - 130px)', borderColor: 'var(--border)' }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 border-b flex items-center justify-between flex-shrink-0"
        style={{ borderColor: 'var(--border)', background: '#f8fafc' }}
      >
        <div>
          <p className="text-sm font-semibold" style={{ color: 'var(--text-primary)' }}>Query Assistant</p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Powered by Gemini via OpenRouter · Run: {runId.slice(0, 12)}…</p>
        </div>
        <span className="flex items-center gap-1.5 text-xs" style={{ color: 'var(--success)' }}>
          <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block" />
          Online
        </span>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 space-y-3" style={{ background: 'var(--background)' }}>
        {messages.map(msg => (
          <div key={msg.id} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div style={{ maxWidth: '78%' }}>
              {/* Role label */}
              <div className={`text-xs mb-1 font-medium ${msg.role === 'user' ? 'text-right' : ''}`} style={{ color: 'var(--text-muted)' }}>
                {msg.role === 'user' ? 'You' : 'Assistant'}
              </div>

              {/* Bubble */}
              <div
                className="px-3.5 py-2.5 rounded-lg text-sm"
                style={
                  msg.role === 'user'
                    ? { background: 'var(--nav-bg)', color: '#fff' }
                    : { background: '#fff', color: 'var(--text-primary)', border: '1px solid var(--border)' }
                }
              >
                <span className="whitespace-pre-wrap">{msg.content}</span>
              </div>

              {/* Tool calls accordion */}
              {msg.toolCalls && msg.toolCalls.length > 0 && (
                <div className="mt-1.5 border rounded-md overflow-hidden text-xs" style={{ borderColor: 'var(--border)' }}>
                  <button
                    onClick={() => setShowTools(p => ({ ...p, [msg.id]: !p[msg.id] }))}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left font-medium transition-colors"
                    style={{ background: '#f1f5f9', color: 'var(--text-secondary)' }}
                  >
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
                    </svg>
                    {msg.toolCalls.length} tool call{msg.toolCalls.length > 1 ? 's' : ''} made
                    <svg className={`w-3 h-3 ml-auto transition-transform ${showTools[msg.id] ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                    </svg>
                  </button>
                  {showTools[msg.id] && (
                    <div className="divide-y" style={{ borderColor: 'var(--border)' }}>
                      {msg.toolCalls.map((tc, i) => (
                        <div key={i} className="px-3 py-2" style={{ background: '#fff' }}>
                          <div className="font-mono font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>{tc.name}()</div>
                          <pre className="text-xs whitespace-pre-wrap break-all" style={{ color: 'var(--text-muted)' }}>
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
            <div className="px-3.5 py-2.5 rounded-lg border text-sm" style={{ background: '#fff', borderColor: 'var(--border)' }}>
              <span className="flex items-center gap-1" style={{ color: 'var(--text-muted)' }}>
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-slate-300 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Suggested chips — shown only early in conversation */}
      {messages.length < 3 && (
        <div className="px-4 py-2 flex gap-2 overflow-x-auto flex-shrink-0 border-t" style={{ borderColor: 'var(--border)', background: '#f8fafc' }}>
          {SUGGESTED.map((q, i) => (
            <button
              key={i}
              onClick={() => send(q)}
              className="text-xs px-3 py-1.5 rounded border whitespace-nowrap transition-colors font-medium"
              style={{ borderColor: 'var(--border)', color: 'var(--accent)', background: 'var(--accent-light)' }}
            >
              {q}
            </button>
          ))}
        </div>
      )}

      {/* Input */}
      <div className="p-3 border-t flex-shrink-0" style={{ borderColor: 'var(--border)', background: '#fff' }}>
        <form onSubmit={e => { e.preventDefault(); send(); }} className="flex items-center gap-2">
          <input
            type="text"
            value={input}
            onChange={e => setInput(e.target.value)}
            placeholder="Ask about transactions, match rate, exceptions…"
            disabled={loading}
            className="flex-1 px-3 py-2 rounded-md border text-sm focus:outline-none focus:ring-2"
            style={{
              borderColor: 'var(--border)',
              color: 'var(--text-primary)',
              background: 'var(--background)',
            }}
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="px-4 py-2 rounded-md text-sm font-medium text-white disabled:opacity-40"
            style={{ background: 'var(--accent)' }}
          >
            Send
          </button>
        </form>
      </div>
    </div>
  );
}
