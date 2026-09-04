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
      <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">No run selected</p>
        <p className="text-xs mt-1 text-slate-400">Run a reconciliation to inspect matched transactions and evidence.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center py-20">
        <svg className="animate-spin w-6 h-6 text-slate-400" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
      </div>
    );
  }

  if (error) {
    return (
      <div className="px-4 py-3 rounded-md border text-sm" style={{ background: 'var(--danger-light)', borderColor: '#fca5a5', color: 'var(--danger)' }}>
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
    <div className="space-y-4">
      {/* Header & Controls */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold" style={{ color: 'var(--text-primary)' }}>
            Reconciled Matches & Evidence Reasons
          </h2>
          <p className="text-xs mt-0.5" style={{ color: 'var(--text-secondary)' }}>
            Audit trail of every reconciled financial match with underlying rationale and evidence breakdown.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200">
            {filteredMatches.length} Matches Found
          </span>
        </div>
      </div>

      {/* Filter Toolbar */}
      <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 bg-white p-3 rounded-lg border" style={{ borderColor: 'var(--border)' }}>
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
            className="w-full pl-9 pr-3 py-1.5 text-xs rounded border bg-slate-50 focus:bg-white focus:outline-none transition-colors"
            style={{ borderColor: 'var(--border)' }}
          />
        </div>

        {/* Type Filter Pills */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0">
          {['ALL', '1:1', 'N:1', '1:N', 'N:M'].map(type => (
            <button
              key={type}
              onClick={() => setTypeFilter(type)}
              className={`px-2.5 py-1 text-xs rounded-md font-medium transition-colors ${
                typeFilter === type
                  ? 'bg-slate-900 text-white'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
              }`}
            >
              {type === 'ALL' ? 'All Types' : type}
            </button>
          ))}
        </div>
      </div>

      {/* Matches Table */}
      {filteredMatches.length === 0 ? (
        <div className="bg-white border rounded-lg p-10 text-center" style={{ borderColor: 'var(--border)' }}>
          <p className="text-sm font-medium text-slate-500">No matches found</p>
          <p className="text-xs text-slate-400 mt-1">Try clearing your search query or filters.</p>
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden shadow-sm" style={{ borderColor: 'var(--border)' }}>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 border-b font-medium text-slate-600" style={{ borderColor: 'var(--border)' }}>
                <tr>
                  <th className="py-3 px-4 w-20">Type</th>
                  <th className="py-3 px-4 w-28">Score</th>
                  <th className="py-3 px-4">Match Reason & Evidence Rationale</th>
                  <th className="py-3 px-4 w-36">Bank Credit</th>
                  <th className="py-3 px-4 w-44">Internal Records (GW/ERP)</th>
                  <th className="py-3 px-4 text-right w-20">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y" style={{ borderColor: 'var(--border)' }}>
                {filteredMatches.map(m => {
                  const isExpanded = expandedId === m.id;
                  const typeStyle = MATCH_TYPE_STYLES[m.matchType] || { bg: '#f1f5f9', text: '#475569', border: '#cbd5e1' };

                  return (
                    <React.Fragment key={m.id}>
                      <tr className="hover:bg-slate-50/80 transition-colors">
                        {/* Type Badge */}
                        <td className="py-3 px-4 align-top">
                          <span
                            className="inline-block px-2 py-0.5 rounded text-[11px] font-semibold border"
                            style={{ background: typeStyle.bg, color: typeStyle.text, borderColor: typeStyle.border }}
                          >
                            {m.matchType}
                          </span>
                        </td>

                        {/* Confidence Score */}
                        <td className="py-3 px-4 align-top">
                          <div className="flex flex-col">
                            <span className="font-semibold text-slate-800">
                              {m.evidenceScore}%
                            </span>
                            <span className="text-[10px] text-slate-400">
                              {m.evidenceScore >= 90 ? 'PROVEN' : m.evidenceScore >= 80 ? 'HIGH' : 'VERIFIED'}
                            </span>
                          </div>
                        </td>

                        {/* Match Reason Rationale */}
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            <div className="font-medium text-slate-800 flex items-center gap-1.5">
                              <svg className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                              <span>{m.primaryReason}</span>
                            </div>

                            {/* Evidence details pills */}
                            {m.evidenceDetails && m.evidenceDetails.length > 1 && (
                              <div className="flex flex-wrap gap-1 mt-1">
                                {m.evidenceDetails.map((ev, i) => (
                                  <span key={i} className="inline-block px-1.5 py-0.5 rounded bg-slate-100 text-[10px] text-slate-600 border border-slate-200">
                                    {ev}
                                  </span>
                                ))}
                              </div>
                            )}
                          </div>
                        </td>

                        {/* Bank Credit Details */}
                        <td className="py-3 px-4 align-top">
                          {m.bankTransactions.length > 0 ? (
                            <div className="space-y-0.5">
                              <div className="font-semibold text-slate-900 tabular-nums">
                                {m.bankTransactions[0].formattedAmount}
                              </div>
                              <div className="text-[11px] font-mono text-slate-600 truncate max-w-[140px]" title={m.bankTransactions[0].utr || m.bankTransactions[0].txnId}>
                                {m.bankTransactions[0].utr || m.bankTransactions[0].txnId}
                              </div>
                              {m.bankTransactions.length > 1 && (
                                <div className="text-[10px] text-indigo-600 font-medium">
                                  +{m.bankTransactions.length - 1} more bank entries
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="text-amber-700 bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200 text-[10px] font-medium">
                              Un-deposited Gateway/ERP
                            </span>
                          )}
                        </td>

                        {/* Internal Records */}
                        <td className="py-3 px-4 align-top">
                          <div className="space-y-1">
                            {m.gatewayTransactions.map(g => (
                              <div key={g.id} className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-slate-700">{g.settlementId || g.txnId}</span>
                                <span className="text-slate-500 tabular-nums">{g.formattedAmount}</span>
                              </div>
                            ))}

                            {m.erpTransactions.map(e => (
                              <div key={e.id} className="flex items-center justify-between text-[11px]">
                                <span className="font-mono text-indigo-700">{e.txnId}</span>
                                <span className="text-slate-500 tabular-nums">{e.formattedAmount}</span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* Expand Details Button */}
                        <td className="py-3 px-4 align-top text-right">
                          <button
                            onClick={() => setExpandedId(isExpanded ? null : m.id)}
                            className="text-xs font-medium text-indigo-600 hover:text-indigo-800 transition-colors"
                          >
                            {isExpanded ? 'Hide' : 'Details'}
                          </button>
                        </td>
                      </tr>

                      {/* Expanded Details Row */}
                      {isExpanded && (
                        <tr className="bg-slate-50/90 border-b" style={{ borderColor: 'var(--border)' }}>
                          <td colSpan={6} className="p-4">
                            <div className="space-y-3 bg-white p-4 rounded border" style={{ borderColor: 'var(--border)' }}>
                              <h4 className="text-xs font-semibold text-slate-900 border-b pb-2 flex items-center justify-between">
                                <span>Audit & Evidence Breakdown</span>
                                <span className="font-mono text-[11px] text-slate-400">Match ID: {m.id}</span>
                              </h4>

                              {/* Evidence Reasoning List */}
                              <div>
                                <div className="text-xs font-medium text-slate-700 mb-1">Evidence Chain:</div>
                                <ul className="list-disc list-inside text-xs space-y-1 text-slate-600 pl-1">
                                  {m.evidenceDetails.map((reason, idx) => (
                                    <li key={idx} className="leading-relaxed">{reason}</li>
                                  ))}
                                </ul>
                              </div>

                              {/* Itemized Transactions Breakdown */}
                              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 pt-2">
                                {/* Bank Side */}
                                <div className="border rounded p-3 bg-slate-50">
                                  <div className="text-xs font-semibold text-slate-700 mb-2">Bank Statement Side</div>
                                  {m.bankTransactions.map(b => (
                                    <div key={b.id} className="text-xs space-y-0.5 py-1 border-b last:border-0">
                                      <div className="flex justify-between font-mono font-medium text-slate-900">
                                        <span>{b.txnId}</span>
                                        <span>{b.formattedAmount}</span>
                                      </div>
                                      <div className="text-slate-500 text-[11px]">UTR: {b.utr || 'N/A'}</div>
                                      <div className="text-slate-500 text-[11px] truncate">{b.description}</div>
                                    </div>
                                  ))}
                                </div>

                                {/* Gateway & ERP Side */}
                                <div className="border rounded p-3 bg-slate-50">
                                  <div className="text-xs font-semibold text-slate-700 mb-2">Internal Ledger / Gateway Side</div>
                                  {m.gatewayTransactions.map(g => (
                                    <div key={g.id} className="text-xs space-y-0.5 py-1 border-b last:border-0">
                                      <div className="flex justify-between font-mono font-medium text-slate-900">
                                        <span>PG: {g.txnId}</span>
                                        <span>{g.formattedAmount}</span>
                                      </div>
                                      <div className="text-slate-500 text-[11px]">Settlement Batch: {g.settlementId || 'N/A'}</div>
                                    </div>
                                  ))}

                                  {m.erpTransactions.map(e => (
                                    <div key={e.id} className="text-xs space-y-0.5 py-1 border-b last:border-0">
                                      <div className="flex justify-between font-mono font-medium text-indigo-900">
                                        <span>ERP: {e.txnId}</span>
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
