'use client';

import React, { useState, useEffect } from 'react';

interface MatchListProps {
  runId: string | null;
}

interface BankTxn {
  id: string;
  txnId: string;
  amount: number;
  formattedAmount: string;
  date: string;
  description: string;
  utr?: string;
}

interface GatewayTxn {
  id: string;
  txnId: string;
  amount: number;
  formattedAmount: string;
  date: string;
  description: string;
  settlementId?: string;
}

interface ErpTxn {
  id: string;
  txnId: string;
  amount: number;
  formattedAmount: string;
  date: string;
  description: string;
  customer?: string;
}

interface MatchItem {
  id: string;
  matchType: string;
  matchPass?: string;
  evidenceScore: number;
  evidenceDetails: string[];
  primaryReason: string;
  isProven: boolean;
  createdAt: string;
  bankTransactions: BankTxn[];
  gatewayTransactions: GatewayTxn[];
  erpTransactions: ErpTxn[];
}

const MATCH_TYPE_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  '1:1': { bg: '#f0fdf4', text: '#15803d', border: '#bbf7d0' },
  'N:1': { bg: '#eff6ff', text: '#1d4ed8', border: '#bfdbfe' },
  '1:N': { bg: '#faf5ff', text: '#7e22ce', border: '#e9d5ff' },
  'N:M': { bg: '#fff7ed', text: '#c2410c', border: '#ffedd5' },
};

export function MatchList({ runId }: MatchListProps) {
  const [matches,    setMatches]    = useState<MatchItem[]>([]);
  const [loading,    setLoading]    = useState(false);
  const [error,      setError]      = useState<string | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>('ALL');
  const [search,     setSearch]     = useState<string>('');
  const [expandedId, setExpandedId] = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/matches?runId=${runId}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load matches'); return r.json(); })
      .then(d => setMatches(d.matches || []))
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-2xl p-8 max-w-xl mx-auto my-8 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center mb-4 border border-emerald-100 shadow-sm">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800">No Run Selected</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Run a reconciliation batch in the <strong className="text-slate-700">Upload & Run</strong> tab to view matched audit chains and evidence.
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
        <p className="text-xs font-semibold text-slate-500">Fetching Audit Evidence Chains…</p>
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

  const filteredMatches = matches.filter(m => {
    if (typeFilter !== 'ALL' && m.matchType !== typeFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
      const matchReason = m.primaryReason.toLowerCase();
      const hasBank = m.bankTransactions.some(b => b.txnId.toLowerCase().includes(q) || b.description.toLowerCase().includes(q) || (b.utr && b.utr.toLowerCase().includes(q)));
      const hasGw = m.gatewayTransactions.some(g => g.txnId.toLowerCase().includes(q) || (g.settlementId && g.settlementId.toLowerCase().includes(q)));
      const hasErp = m.erpTransactions.some(e => e.txnId.toLowerCase().includes(q));
      return matchReason.includes(q) || hasBank || hasGw || hasErp;
    }
    return true;
  });

  return (
    <div className="space-y-5 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
            <span>3-Way Reconciled Matches & Evidence</span>
            <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
              {filteredMatches.length} Verified Groups
            </span>
          </h2>
          <p className="text-xs text-slate-500 mt-1">
            Complete ICFR audit evidence linking Bank Deposits ↔ Payment Gateway Settlements ↔ ERP Invoices.
          </p>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3.5 rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        {/* Search Input */}
        <div className="relative flex-1 max-w-md">
          <svg className="w-4 h-4 absolute left-3 top-2.5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            placeholder="Search by UTR, Txn ID, Settlement ID, or reason..."
            value={search}
            onChange={e => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded-lg border bg-slate-50 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500/20 transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', '1:1', 'N:1', '1:N', 'N:M'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-3 py-1 text-xs rounded-lg font-bold transition-all ${
                typeFilter === type
                  ? 'bg-slate-900 text-white shadow-sm'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Cardinalities' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Table */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white border rounded-2xl p-12 text-center shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-bold text-slate-700">No matches found</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing your search query or switching filters.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-2xl overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50/80 border-b font-bold text-slate-600 uppercase tracking-wider text-[10px]" style={{ borderColor: 'var(--border)' }}>
                <tr>
                  <th className="py-3 px-4 w-20">Cardinality</th>
                  <th className="py-3 px-4 w-24">Confidence</th>
                  <th className="py-3 px-4">Match Rationale & Evidence</th>
                  <th className="py-3 px-4 w-40">Bank Deposit</th>
                  <th className="py-3 px-4 w-48">Internal Records (GW / ERP)</th>
                  <th className="py-3 px-4 text-right w-20">Details</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredMatches.map(m => {
                  const isExpanded = expandedId === m.id;
                  const typeStyle = MATCH_TYPE_STYLES[m.matchType] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

                  return (
                    <React.Fragment key={m.id}>
                      <tr className="hover:bg-blue-50/20 transition-colors">
                        {/* Type Badge */}
                        <td className="py-3.5 px-4 align-top">
                          <span
                            className="inline-block px-2.5 py-0.5 rounded-full text-[11px] font-extrabold border shadow-2xs"
                            style={{ background: typeStyle.bg, color: typeStyle.text, borderColor: typeStyle.border }}
                          >
                            {m.matchType}
                          </span>
                        </td>

                        {/* Confidence Score */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-extrabold text-slate-900 tabular-nums">
                              {m.evidenceScore}%
                            </span>
                            <span className="text-[10px] font-semibold text-emerald-700">
                              {m.evidenceScore >= 90 ? 'PROVEN' : m.evidenceScore >= 80 ? 'HIGH' : 'VERIFIED'}
                            </span>
                          </div>
                        </td>

                        {/* Match Reason Rationale */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>{m.primaryReason}</span>
                            </div>

                            {/* Evidence details pills */}
                            {m.evidenceDetails && m.evidenceDetails.length > 1 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.evidenceDetails.map((ev, i) => (
                                  <span key={i} className="inline-block px-2 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200 font-medium">
                                    {ev}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Bank Credit Details */}
                        <td className="py-3.5 px-4 align-top">
                          {m.bankTransactions.length > 0 ? (
                            <div className="space-y-0.5">
                              <div className="font-bold text-slate-900 tabular-nums">
                                {m.bankTransactions[0].formattedAmount}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 truncate max-w-[140px]" title={m.bankTransactions[0].utr || m.bankTransactions[0].txnId}>
                                {m.bankTransactions[0].utr || m.bankTransactions[0].txnId}
                              </div>
                              {m.bankTransactions.length > 1 && (
                                <div className="text-[10px] text-blue-600 font-bold">
                                  +{m.bankTransactions.length - 1} more bank entries
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-2 py-0.5 rounded border border-amber-200 text-[10px] font-bold">
                              Un-deposited Gateway/ERP
                            </span>
                          )}
                        </td>

                        {/* Internal Records */}
                        <td className="py-3.5 px-4 align-top">
                          <div className="space-y-1">
                            {m.gatewayTransactions.map(g => (
                              <div key={g.id} className="flex items-center justify-between text-[11px] bg-slate-50 px-2 py-1 rounded border border-slate-100">
                                <span className="font-mono text-slate-700 font-semibold">{g.settlementId || g.txnId}</span>
                                <span className="text-slate-600 tabular-nums font-medium">{g.formattedAmount}</span>
                              </div>
                            ))}

                            {m.erpTransactions.map(e => (
                              <div key={e.id} className="flex items-center justify-between text-[11px] bg-indigo-50/50 px-2 py-1 rounded border border-indigo-100">
                                <span className="font-mono text-indigo-700 font-semibold">{e.txnId}</span>
                                <span className="text-slate-600 tabular-nums font-medium">{e.formattedAmount}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Expand Details Button */}
                        <td className="py-3.5 px-4 align-top text-right">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            className="px-2.5 py-1 rounded-md text-xs font-bold text-blue-600 hover:bg-blue-50 border border-blue-200 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Audit'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b" style={{ borderColor: 'var(--border)' }}>
                          <td colSpan={6} className="p-4">
                            <div className="space-y-3 bg-white p-4 rounded-xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
                              <div className="text-xs font-bold text-slate-900 border-b pb-2 flex items-center justify-between">
                                <span>3-Way Audit Chain & Evidence Rationale</span>
                                <span className="font-mono text-[11px] text-slate-400">Match ID: {m.id}</span>
                              </div>

                              {/* Evidence Reasoning List */}
                              <div>
                                <div className="text-xs font-semibold text-slate-700 mb-1">Mathematical Rationale:</div>
                                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1 font-medium">
                                  {m.evidenceDetails.map((reason, idx) => (
                                    <li key={idx} className="leading-relaxed">{reason}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* Itemized Transactions Breakdown */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                {/* Bank Side */}
                                <div className="border rounded-xl p-3 bg-slate-50">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-emerald-500" />
                                    <span>Bank Statement Side</span>
                                  </div>
                                  {m.bankTransactions.map(b => (
                                    <div key={b.id} className="text-xs space-y-0.5 py-1.5 border-b last:border-0 border-slate-200/60">
                                      <div className="flex justify-between font-mono font-bold text-slate-900">
                                        <span>{b.txnId}</span>
                                        <span>{b.formattedAmount}</span>
                                      </div>
                                      <div className="text-slate-500 text-[11px]">UTR: {b.utr || 'N/A'}</div>
                                      <div className="text-slate-500 text-[11px] truncate">{b.description}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Gateway & ERP Side */}
                                <div className="border rounded-xl p-3 bg-slate-50">
                                  <div className="text-xs font-bold text-slate-800 mb-2 flex items-center gap-1.5">
                                    <span className="w-2 h-2 rounded-full bg-blue-500" />
                                    <span>Internal Gateway & ERP Side</span>
                                  </div>
                                  {m.gatewayTransactions.map(g => (
                                    <div key={g.id} className="text-xs space-y-0.5 py-1.5 border-b last:border-0 border-slate-200/60">
                                      <div className="flex justify-between font-mono font-bold text-slate-900">
                                        <span>PG: {g.txnId}</span>
                                        <span>{g.formattedAmount}</span>
                                      </div>
                                      <div className="text-slate-500 text-[11px]">Settlement Batch: {g.settlementId || 'N/A'}</div>
                                    </div>
                                  ))}

                                  {m.erpTransactions.map(e => (
                                    <div key={e.id} className="text-xs space-y-0.5 py-1.5 border-b last:border-0 border-slate-200/60">
                                      <div className="flex justify-between font-mono font-bold text-indigo-900">
                                        <span>ERP Invoice: {e.txnId}</span>
                                        <span>{e.formattedAmount}</span>
                                      </div>
                                      {e.customer && <div className="text-slate-500 text-[11px]">Customer: {e.customer}</div>}
                                    </div>
                                  ))}
                                </div>
                              </div>
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
