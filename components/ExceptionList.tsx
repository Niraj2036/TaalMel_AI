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
  testedHypothesis?: string | null;
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
      .then(r => { if (!r.ok) throw new Error('Failed to load exceptions'); return r.json(); })
      .then(setExceptions)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  const handleApprove = async (id: string) => {
    setApproving(id);
    try {
      const res = await fetch(`/api/exceptions/${id}/approve`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ approvedBy: 'Finance Controller (Maker/Checker)' }),
      });
      if (!res.ok) throw new Error('Failed to approve');
      setExceptions(prev =>
        prev.map(ex => (ex.id === id ? { ...ex, status: 'RESOLVED' } : ex))
      );
    } catch (e: any) {
      alert(e.message || 'Approval failed');
    } finally {
      setApproving(null);
    }
  };

  const handleRunInvestigation = async (exc: ExceptionRow) => {
    setInvestigating(exc.id);
    try {
      const res = await fetch('/api/agent/investigate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ exceptionId: exc.id }),
      });
      const data = await res.json();
      if (data.exception) {
        setExceptions(prev => prev.map(e => e.id === exc.id ? { ...e, ...data.exception } : e));
      }
    } catch {
      alert('Investigation error.');
    } finally {
      setInvestigating(null);
    }
  };

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-2xl p-8 max-w-xl mx-auto my-8 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl bg-amber-50 text-amber-600 flex items-center justify-center mb-4 border border-amber-100 shadow-sm">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800">No Run Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Run a reconciliation batch in the <strong className="text-slate-700">Upload & Run</strong> tab to route exceptions here.
        </p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-3">
        <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs font-semibold text-slate-500">Loading Exceptions & SLA Aging Dashboard…</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-lg border text-xs font-medium bg-rose-50 border-rose-200 text-rose-700">
        {error}
      </div>
    );
  }

  const list = exceptions.filter(e => {
    if (filter === 'Open') return e.status !== 'RESOLVED';
    if (filter === 'Resolved') return e.status === 'RESOLVED';
    return true;
  });

  const openCount = exceptions.filter(e => e.status !== 'RESOLVED').length;
  const slaBreachCount = exceptions.filter(e => e.isSLABreach && e.status !== 'RESOLVED').length;

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>Exception Controller & Accounting Proposals</span>
            <span className="text-xs font-bold px-2.5 py-0.5 rounded-full bg-amber-100 text-amber-800 border border-amber-200">
              {openCount} Open Exceptions
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Deterministic diagnosis, SLA aging tracking, and self-healing double-entry journal entry proposals.
          </p>
        </div>

        {/* PII Shield Badge */}
        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-slate-900 text-white text-xs font-medium shadow-sm">
          <svg className="w-4 h-4 text-emerald-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
          <span>Bank-Grade PII Anonymization Active</span>
        </div>
      </div>

      {/* SLA Breach Alert Callout */}
      {slaBreachCount > 0 && (
        <div className="bg-rose-50 border border-rose-200 p-4 rounded-xl flex items-center justify-between gap-3 text-xs text-rose-800 shadow-sm">
          <div className="flex items-center gap-2 font-semibold">
            <svg className="w-5 h-5 text-rose-600 animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <span>SLA Breach Warning: {slaBreachCount} exception(s) unresolved past 48h limit!</span>
          </div>
          <span className="text-[11px] font-bold px-2 py-0.5 rounded bg-rose-200 text-rose-900 uppercase">High Priority</span>
        </div>
      )}

      {/* Filter Tabs */}
      <div className="flex items-center gap-2 border-b pb-2" style={{ borderColor: 'var(--border)' }}>
        {(['All', 'Open', 'Resolved'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setFilter(tab)}
            className={`px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
              filter === tab
                ? 'bg-blue-600 text-white shadow-sm'
                : 'bg-white text-slate-600 hover:bg-slate-100 border border-slate-200'
            }`}
          >
            {tab} Exceptions ({tab === 'All' ? exceptions.length : tab === 'Open' ? openCount : exceptions.length - openCount})
          </button>
        ))}
      </div>

      {/* Exception Table */}
      {list.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-bold text-slate-700">No exceptions match filter</p>
          <p className="text-xs text-slate-400 mt-1">Switch tabs to view all exceptions.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b font-bold text-slate-600 uppercase tracking-wider text-[10px]" style={{ borderColor: 'var(--border)' }}>
                <tr>
                  <th className="py-3 px-4 w-28">Severity</th>
                  <th className="py-3 px-4 w-36">Exception Type</th>
                  <th className="py-3 px-4">Description & Evidence</th>
                  <th className="py-3 px-4 w-28">Variance</th>
                  <th className="py-3 px-4 w-32">SLA Aging</th>
                  <th className="py-3 px-4 w-32">Status</th>
                  <th className="py-3 px-4 text-right w-24">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {list.map(exc => {
                  const isExp = expandedId === exc.id;
                  const sevStyle = SEVERITY_STYLES[exc.severity] || SEVERITY_STYLES.MEDIUM;
                  const stStyle  = STATUS_STYLES[exc.status]   || STATUS_STYLES.OPEN;

                  return (
                    <React.Fragment key={exc.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        {/* Severity */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold border uppercase tracking-wide"
                            style={{ background: sevStyle.bg, color: sevStyle.text, borderColor: sevStyle.border }}
                          >
                            {exc.severity}
                          </span>
                        </td>

                        {/* Type */}
                        <td className="py-3.5 px-4 align-top font-bold text-slate-900">
                          {exc.type.replace(/_/g, ' ')}
                        </td>

                        {/* Description */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <p className="font-semibold text-slate-800">{exc.description}</p>
                            <div className="text-[10px] font-mono text-slate-400">
                              Txn IDs: {exc.transactionIds.join(', ')}
                            </div>
                          </div>
                        </td>

                        {/* Amount Diff */}
                        <td className="py-3.5 px-4 align-top font-mono font-bold text-slate-900 tabular-nums">
                          {exc.amountDiff ? fmt(exc.amountDiff) : '—'}
                        </td>

                        {/* SLA Tag */}
                        <td className="py-3.5 px-4 align-top">
                          <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-bold ${
                            exc.isSLABreach ? 'bg-rose-100 text-rose-800 border border-rose-300 animate-pulse' : 'bg-slate-100 text-slate-600'
                          }`}>
                            {exc.slaTag || 'Active'}
                          </span>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[10px] font-extrabold uppercase"
                            style={{ background: stStyle.bg, color: stStyle.text }}
                          >
                            {exc.status.replace(/_/g, ' ')}
                          </span>
                        </td>

                        {/* Action */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <button
                            onClick={() => setExpandedId(isExp ? null : exc.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            {isExp ? 'Hide' : 'Review'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Section */}
                      {isExp && (
                        <tr className="bg-slate-50 border-b" style={{ borderColor: 'var(--border)' }}>
                          <td colSpan={7} className="p-4">
                            <div className="bg-white p-5 rounded-xl border space-y-4 shadow-sm" style={{ borderColor: 'var(--border)' }}>
                              <div className="flex items-center justify-between border-b pb-3">
                                <div>
                                  <h4 className="text-xs font-bold text-slate-900">Tier-2 Autonomous AI Investigation & Journal Safety</h4>
                                  <p className="text-[11px] text-slate-500">Mathematical hypothesis solver & double-entry Maker/Checker proposal validation.</p>
                                </div>
                                <button
                                  onClick={() => handleRunInvestigation(exc)}
                                  disabled={investigating === exc.id}
                                  className="px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-bold transition-all disabled:opacity-50 shadow-xs flex items-center gap-1.5"
                                >
                                  {investigating === exc.id ? (
                                    <span>Solving Hypothesis…</span>
                                  ) : (
                                    <>
                                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
                                      </svg>
                                      <span>Run Tier-2 AI Solver</span>
                                    </>
                                  )}
                                </button>
                              </div>

                              {/* Verified AI Hypothesis Display */}
                              {exc.hypothesisVerified && exc.verifiedHypothesis && (
                                <div className="p-3.5 rounded-xl bg-emerald-50/80 border border-emerald-200 text-xs space-y-1.5 shadow-xs">
                                  <div className="font-bold text-emerald-950 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-4 h-4 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                                      </svg>
                                      <span>Verified AI Hypothesis: {exc.verifiedHypothesis}</span>
                                    </div>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900 uppercase tracking-wide">
                                      ICFR Verified
                                    </span>
                                  </div>
                                  {exc.proofReasoning && (
                                    <p className="text-slate-700 text-[11px] leading-relaxed pl-5 font-mono">{exc.proofReasoning}</p>
                                  )}
                                </div>
                              )}

                              {/* Tested & Rejected LLM Hypothesis Display */}
                              {exc.hypothesisVerified === false && exc.testedHypothesis && (
                                <div className="p-3.5 rounded-xl bg-rose-50/90 border border-rose-200 text-xs space-y-2 shadow-xs">
                                  <div className="font-bold text-rose-950 flex items-center justify-between">
                                    <div className="flex items-center gap-1.5">
                                      <svg className="w-4 h-4 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                                      </svg>
                                      <span>Tested & Rejected LLM Hypothesis</span>
                                    </div>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-rose-200 text-rose-900 uppercase tracking-wide">
                                      ICFR Guardrail Enforced
                                    </span>
                                  </div>
                                  <div className="pl-5 space-y-1">
                                    <p className="text-slate-800 text-[11px] font-medium">
                                      <strong className="text-slate-900">Tested Hypothesis:</strong> {exc.testedHypothesis}
                                    </p>
                                    {exc.proofReasoning && (
                                      <p className="text-rose-800 text-[11px] font-mono leading-relaxed bg-rose-100/60 p-2 rounded border border-rose-200">
                                        <strong className="text-rose-900">Reason for Rejection:</strong> {exc.proofReasoning}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              )}

                              {/* Proposed Double-Entry Journal Proposal */}
                              {exc.journalProposal ? (
                                <div className="border rounded-xl p-4 bg-slate-50/80 space-y-3">
                                  <div className="flex items-center justify-between border-b pb-2">
                                    <span className="text-xs font-bold text-slate-900">Proposed Accounting Journal Entry</span>
                                    <span className="text-[10px] font-extrabold px-2 py-0.5 rounded bg-emerald-100 text-emerald-800 border border-emerald-200">
                                      Balanced (Debit = Credit)
                                    </span>
                                  </div>

                                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                                    {/* Debits */}
                                    <div className="space-y-1 bg-white p-3 rounded-lg border">
                                      <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-1">Debits (Dr)</div>
                                      {exc.journalProposal.debit.map((line, idx) => (
                                        <div key={idx} className="flex justify-between font-mono py-1 border-b last:border-0 border-slate-100">
                                          <span className="text-slate-800 font-semibold">{line.account}</span>
                                          <span className="text-slate-900 font-bold">{fmt(line.amount)}</span>
                                        </div>
                                      ))}
                                    </div>

                                    {/* Credits */}
                                    <div className="space-y-1 bg-white p-3 rounded-lg border">
                                      <div className="font-bold text-slate-700 text-[11px] uppercase tracking-wider mb-1">Credits (Cr)</div>
                                      {exc.journalProposal.credit.map((line, idx) => (
                                        <div key={idx} className="flex justify-between font-mono py-1 border-b last:border-0 border-slate-100">
                                          <span className="text-slate-800 font-semibold">{line.account}</span>
                                          <span className="text-slate-900 font-bold">{fmt(line.amount)}</span>
                                        </div>
                                      ))}
                                    </div>
                                  </div>

                                  {/* Maker-Checker Approval Action */}
                                  {exc.status !== 'RESOLVED' && (
                                    <div className="pt-2 flex justify-end">
                                      <button
                                        onClick={() => handleApprove(exc.id)}
                                        disabled={approving === exc.id}
                                        className="px-4 py-2 rounded-lg bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold transition-all shadow-md disabled:opacity-50 flex items-center gap-1.5"
                                      >
                                        {approving === exc.id ? (
                                          <span>Approving Journal…</span>
                                        ) : (
                                          <>
                                            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                            </svg>
                                            <span>Approve & Post Journal Entry</span>
                                          </>
                                        )}
                                      </button>
                                    </div>
                                  )}
                                </div>
                              ) : (
                                <div className="p-4 rounded-xl border bg-slate-50 text-center">
                                  <p className="text-xs font-bold text-slate-600">No journal entry proposed — insufficient evidence</p>
                                  <p className="text-[11px] text-slate-400 mt-0.5">Safety guardrail active: Unverified AI hypotheses keep exceptions OPEN without fabricating journal entries.</p>
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
        </div>
      )}
    </div>
  );
}
