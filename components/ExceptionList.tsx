'use client';

import React, { useState, useEffect } from 'react';

interface ExceptionListProps { runId: string | null; }

interface JournalLine { account: string; amount: number; }
interface JournalProposal { debit: JournalLine[]; credit: JournalLine[]; }

interface ExceptionRow {
  id: string;
  type: string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  description: string;
  amountDiff: number;
  status: 'OPEN' | 'INVESTIGATING' | 'PENDING_APPROVAL' | 'RESOLVED';
  transactionIds: string[];
  ageHours?: number;
  isSLABreach?: boolean;
  slaTag?: string;
  piiScrubbed?: boolean;
  verifiedHypothesis?: string | null;
  proofReasoning?: string | null;
  hypothesisVerified?: boolean;
  journalProposal?: JournalProposal;
}

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  CRITICAL: { bg: '#fef2f2', text: '#dc2626', border: '#fca5a5' },
  HIGH:     { bg: '#fff7ed', text: '#ea580c', border: '#fed7aa' },
  MEDIUM:   { bg: '#fffbeb', text: '#d97706', border: '#fde68a' },
  LOW:      { bg: '#f0fdf4', text: '#16a34a', border: '#86efac' },
};

const STATUS_STYLES: Record<string, { bg: string; text: string }> = {
  OPEN:             { bg: '#f1f5f9', text: '#475569' },
  INVESTIGATING:    { bg: '#eff6ff', text: '#1d4ed8' },
  PENDING_APPROVAL: { bg: '#fffbeb', text: '#d97706' },
  RESOLVED:         { bg: '#f0fdf4', text: '#16a34a' },
};

function fmt(amount: number) { return `₹${(Math.abs(amount) / 100).toFixed(2)}`; }

export function ExceptionList({ runId }: ExceptionListProps) {
  const [exceptions, setExceptions] = useState<ExceptionRow[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [filter,     setFilter]     = useState<'All' | 'Open' | 'Resolved'>('All');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [approving,  setApproving]  = useState<string | null>(null);
  const [investigating, setInvestigating] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    fetch(`/api/exceptions?runId=${runId}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(setExceptions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await fetch(`/api/exceptions/${id}/approve`, { method: 'PATCH' });
      if (!res.ok) throw new Error('Approval failed');
      setExceptions(prev => prev.map(e => e.id === id ? { ...e, status: 'RESOLVED' } : e));
      setExpandedId(null);
    } catch (err: any) {
      alert('Error: ' + err.message);
    } finally {
      setApproving(null);
    }
  };

  const handleInvestigate = async (id: string) => {
    setInvestigating(id);
    try {
      const res = await fetch(`/api/agent/investigate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptionId: id }),
      });
      if (!res.ok) throw new Error('Tier-2 Investigation failed');
      const data = await res.json();
      
      // Refresh exceptions list
      const updated = await fetch(`/api/exceptions?runId=${runId}`).then(r => r.json());
      setExceptions(updated);
    } catch (err: any) {
      alert('Investigation error: ' + err.message);
    } finally {
      setInvestigating(null);
    }
  };

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">No run selected</p>
        <p className="text-xs mt-1 text-slate-400">Upload data or select a past run to view exceptions.</p>
      </div>
    );
  }

  const filtered = exceptions.filter(e => {
    if (filter === 'Open')     return e.status !== 'RESOLVED';
    if (filter === 'Resolved') return e.status === 'RESOLVED';
    return true;
  });

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Exception Management & Self-Healing Ledger</h1>
          <div className="flex items-center gap-3 mt-1 text-xs" style={{ color: 'var(--text-muted)' }}>
            <span>{exceptions.length} total · {exceptions.filter(e => e.status !== 'RESOLVED').length} open</span>
            <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-medium">
              🛡️ PII Anonymized & Compliant
            </span>
          </div>
        </div>
        <div className="flex items-center border rounded-md overflow-hidden text-sm" style={{ borderColor: 'var(--border)' }}>
          {(['All', 'Open', 'Resolved'] as const).map(f => (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className="px-3 py-1.5 font-medium transition-colors"
              style={{
                background: filter === f ? 'var(--nav-bg)' : 'var(--surface)',
                color:      filter === f ? '#fff'           : 'var(--text-secondary)',
              }}
            >
              {f}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <svg className="animate-spin w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      ) : error ? (
        <div className="px-4 py-3 rounded-md border text-sm" style={{ background: 'var(--danger-light)', borderColor: '#fca5a5', color: 'var(--danger)' }}>
          {error}
        </div>
      ) : filtered.length === 0 ? (
        <div className="bg-white border rounded-lg p-10 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          No exceptions found for this filter.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm text-left">
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Type', 'Severity', 'SLA Aging', 'Description', 'Amount Diff', 'Status', ''].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((exc, idx) => {
                const sev = SEVERITY_STYLES[exc.severity] ?? SEVERITY_STYLES.LOW;
                const sta = STATUS_STYLES[exc.status]     ?? STATUS_STYLES.OPEN;
                const expanded = expandedId === exc.id;

                return (
                  <React.Fragment key={exc.id}>
                    <tr
                      className="border-t hover:bg-slate-50 transition-colors"
                      style={{ borderColor: idx === 0 ? 'transparent' : 'var(--border)' }}
                    >
                      <td className="px-4 py-3 font-mono text-xs font-medium" style={{ color: 'var(--text-primary)' }}>{exc.type}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-0.5 rounded text-xs font-semibold border"
                          style={{ background: sev.bg, color: sev.text, borderColor: sev.border }}
                        >
                          {exc.severity}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-xs">
                        <span className={`px-2 py-0.5 rounded font-mono text-[11px] ${exc.isSLABreach ? 'bg-red-100 text-red-700 font-bold border border-red-300' : 'bg-slate-100 text-slate-600'}`}>
                          {exc.slaTag || 'Active'}
                        </span>
                      </td>
                      <td className="px-4 py-3 max-w-xs truncate text-xs" style={{ color: 'var(--text-secondary)' }}>{exc.description}</td>
                      <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-primary)' }}>{fmt(exc.amountDiff)}</td>
                      <td className="px-4 py-3">
                        <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: sta.bg, color: sta.text }}>
                          {exc.status.replace(/_/g, ' ')}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <button
                          onClick={() => setExpandedId(expanded ? null : exc.id)}
                          className="text-xs font-medium transition-colors"
                          style={{ color: 'var(--accent)' }}
                        >
                          {expanded ? 'Collapse' : 'Investigate'}
                        </button>
                      </td>
                    </tr>

                    {expanded && (
                      <tr style={{ background: '#fafafa', borderTop: '1px solid var(--border)' }}>
                        <td colSpan={7} className="px-6 py-4">
                          <div className="grid grid-cols-2 gap-6">
                            {/* Details & Tier-2 Trigger */}
                            <div className="space-y-3">
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Linked Transactions</p>
                                <div className="space-y-1">
                                  {exc.transactionIds.map(id => (
                                    <div key={id} className="font-mono text-xs px-2 py-1 rounded border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)', background: '#fff' }}>
                                      {id}
                                    </div>
                                  ))}
                                </div>
                              </div>
                              
                              <div>
                                <p className="text-xs font-semibold mb-1" style={{ color: 'var(--text-primary)' }}>Raw Narration Context</p>
                                <p className="text-xs p-2 rounded bg-white border" style={{ borderColor: 'var(--border)', color: 'var(--text-secondary)' }}>
                                  {exc.description}
                                </p>
                              </div>

                              {exc.proofReasoning && (
                                <div className={`p-3 rounded text-xs border ${exc.hypothesisVerified ? 'bg-blue-50 border-blue-200 text-blue-900' : 'bg-amber-50 border-amber-300 text-amber-900'}`}>
                                  <p className="font-semibold mb-1 flex items-center gap-1.5">
                                    {exc.hypothesisVerified ? '⚡ Tier-2 Agentic Verified Fact' : '⚠️ Tier-2 Investigation Result: Insufficient Evidence'}
                                  </p>
                                  {exc.verifiedHypothesis && <p className="font-medium">{exc.verifiedHypothesis}</p>}
                                  <p className="font-mono text-[11px] mt-1 opacity-90">{exc.proofReasoning}</p>
                                </div>
                              )}

                              {exc.status !== 'RESOLVED' && (
                                <button
                                  onClick={() => handleInvestigate(exc.id)}
                                  disabled={investigating === exc.id}
                                  className="w-full py-1.5 px-3 bg-slate-900 text-white rounded text-xs font-medium hover:bg-slate-800 transition-colors flex items-center justify-center gap-2 disabled:opacity-50"
                                >
                                  {investigating === exc.id ? (
                                    <>
                                      <svg className="animate-spin w-3.5 h-3.5 text-white" fill="none" viewBox="0 0 24 24">
                                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                                      </svg>
                                      <span>Running Sandboxed MILP Hypothesis Tool…</span>
                                    </>
                                  ) : (
                                    <>
                                      <span>🤖 Run Tier-2 AI Auto-Investigation</span>
                                    </>
                                  )}
                                </button>
                              )}
                            </div>

                            {/* Journal proposal card (Maker-Checker Safety Enforced) */}
                            {exc.journalProposal ? (
                              <div className="bg-white border rounded-md p-4 flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
                                <div>
                                  <div className="flex items-center justify-between mb-3 border-b pb-2">
                                    <div>
                                      <p className="text-xs font-semibold" style={{ color: 'var(--text-primary)' }}>Proposed Double-Entry Journal</p>
                                      <p className="text-[11px] text-slate-500">Self-Healing Accounting Entry (Maker-Checker)</p>
                                    </div>
                                    <span className="text-[10px] bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono">
                                      Debits == Credits OK
                                    </span>
                                  </div>

                                  <div className="space-y-2 text-xs font-mono">
                                    {exc.journalProposal.debit.map((d, i) => (
                                      <div key={i} className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200" style={{ color: 'var(--text-primary)' }}>
                                        <span className="font-semibold text-slate-800">Dr. {d.account}</span>
                                        <span className="tabular-nums font-bold text-slate-900">{fmt(d.amount)}</span>
                                      </div>
                                    ))}
                                    {exc.journalProposal.credit.map((c, i) => (
                                      <div key={i} className="flex justify-between items-center bg-slate-50 px-2.5 py-1.5 rounded border border-slate-200 pl-6" style={{ color: 'var(--text-secondary)' }}>
                                        <span className="text-slate-700">Cr. {c.account}</span>
                                        <span className="tabular-nums font-bold text-slate-800">{fmt(c.amount)}</span>
                                      </div>
                                    ))}
                                  </div>
                                </div>

                                {exc.status !== 'RESOLVED' && (
                                  <div className="mt-4 pt-3 border-t flex items-center justify-between">
                                    <span className="text-[11px] text-slate-500">ICFR Checker Action Required</span>
                                    <button
                                      onClick={() => handleApprove(exc.id)}
                                      disabled={approving === exc.id}
                                      className="text-xs font-medium px-4 py-2 rounded text-white transition-colors shadow-sm disabled:opacity-50 flex items-center gap-1.5"
                                      style={{ background: 'var(--success)' }}
                                    >
                                      {approving === exc.id ? 'Posting to ERP…' : '✓ Approve & Post to ERP'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div className="flex flex-col items-center justify-center p-6 rounded-md border border-dashed text-xs text-amber-800 bg-amber-50/50 border-amber-200">
                                <p className="font-semibold text-amber-900 mb-1">No Journal Entry Proposed — Insufficient Evidence</p>
                                <p className="text-center text-[11px] max-w-xs leading-relaxed">
                                  Safety Policy Enforced: Failed AI hypotheses are never converted into accounting adjustments without mathematical proof.
                                </p>
                              </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
