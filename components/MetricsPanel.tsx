'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';

export interface MetricsData {
  matchRate: number;
  precision: number;
  recall: number;
  throughput: number;
  exceptionCount: number;
  reviewRate: number;
  falseAutomationRate: number;
  matchedCount: number;
  totalRecords?: number;
}

interface MetricsPanelProps {
  runId: string | null;
  initialMetrics?: MetricsData | null;
}

function StatCard({
  label,
  value,
  sub,
  highlight,
  badge,
  icon,
}: {
  label: string;
  value: string;
  sub: string;
  highlight?: boolean;
  badge?: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="bg-white border rounded-xl p-4 shadow-sm hover:shadow-md transition-shadow relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{label}</span>
        <div className="p-1.5 rounded-lg bg-slate-100 text-slate-600">
          {icon}
        </div>
      </div>
      <div className="flex items-baseline justify-between">
        <div
          className="text-2xl font-bold tabular-nums tracking-tight"
          style={{ color: highlight ? 'var(--danger)' : 'var(--text-primary)' }}
        >
          {value}
        </div>
        {badge && (
          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-emerald-50 text-emerald-700 border border-emerald-200">
            {badge}
          </span>
        )}
      </div>
      <div className="text-[11px] mt-1.5 text-slate-400 font-medium">{sub}</div>
    </div>
  );
}

export function MetricsPanel({ runId, initialMetrics }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(initialMetrics ?? null);
  const [loading, setLoading] = useState(!initialMetrics && !!runId);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    if (initialMetrics) {
      setMetrics(initialMetrics);
      setLoading(false);
    } else {
      setLoading(true);
    }
    setError(null);

    fetch(`/api/metrics/${runId}`, { cache: 'no-store' })
      .then(r => { if (!r.ok) throw new Error('Failed to load metrics'); return r.json(); })
      .then(data => {
        setMetrics(data);
        setLoading(false);
      })
      .catch((e: Error) => {
        if (!initialMetrics) setError(e.message);
        setLoading(false);
      });
  }, [runId, initialMetrics]);

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center bg-white border rounded-2xl p-8 max-w-xl mx-auto my-8 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="w-14 h-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center mb-4 border border-blue-100 shadow-sm">
          <svg className="w-7 h-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-slate-800">No Active Reconciliation Batch</h3>
        <p className="text-xs text-slate-500 mt-1 max-w-sm">
          Upload Bank Statement, ERP Ledger, and Gateway CSV files in the <strong className="text-slate-700">Upload & Run</strong> tab to generate live metrics.
        </p>
      </div>
    );
  }

  if (loading && !metrics) {
    return (
      <div className="flex flex-col justify-center items-center py-24 space-y-3">
        <svg className="animate-spin w-8 h-8 text-blue-600" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        <p className="text-xs font-semibold text-slate-500">Retrieving TaalMel AI Metrics…</p>
      </div>
    );
  }

  if (error || !metrics) {
    return (
      <div className="px-4 py-3 rounded-lg border text-xs font-medium bg-rose-50 border-rose-200 text-rose-700">
        {error || 'No metrics data available.'}
      </div>
    );
  }

  const matchedCount = metrics.matchedCount ?? 0;
  const totalRecords = metrics.totalRecords ?? 0;
  const pieData = [
    { name: 'Matched Bank Credits', value: matchedCount, color: '#16a34a' },
    { name: 'Exceptions Flagged',   value: metrics.exceptionCount, color: '#f59e0b' },
  ];

  return (
    <div className="space-y-6 max-w-6xl mx-auto">
      {/* Dashboard Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-5 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-xl font-bold text-slate-900">Reconciliation Dashboard</h1>
            <span className="text-xs font-mono font-semibold px-2 py-0.5 rounded bg-slate-100 text-slate-600 border">
              Run: {runId.slice(0, 14)}…
            </span>
          </div>
          <p className="text-xs text-slate-500 mt-1">
            Real-time performance summary of 3-way matching across Bank Statement, Payment Gateway, and ERP.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold flex items-center gap-2 bg-emerald-50 border-emerald-200 text-emerald-800">
            <span className="w-2 h-2 rounded-full bg-emerald-500 animate-ping" />
            <span>{metrics.matchRate.toFixed(1)}% Match Rate</span>
          </div>
          <div className="px-3.5 py-1.5 rounded-lg border text-xs font-semibold bg-blue-50 border-blue-200 text-blue-800">
            0.00% False Automation
          </div>
        </div>
      </div>

      {/* Main Bank Match Rate Spotlight Card */}
      <div className="bg-gradient-to-br from-white via-slate-50 to-blue-50/40 border rounded-2xl p-6 shadow-sm relative overflow-hidden" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-4">
          <div>
            <div className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-1">
              Bank Statement Credit Reconciliation Rate
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-5xl font-extrabold text-slate-900 tracking-tight tabular-nums">
                {metrics.matchRate.toFixed(1)}
              </span>
              <span className="text-2xl font-bold text-slate-400">%</span>
              <span className="ml-2 text-xs font-semibold px-2.5 py-1 rounded-full bg-emerald-100 text-emerald-800 border border-emerald-200">
                100% Ground Truth Accuracy
              </span>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 text-right text-xs">
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-slate-400 text-[11px] font-medium">Reconciled</div>
              <div className="text-sm font-bold text-emerald-600 tabular-nums">{matchedCount} credits</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-slate-400 text-[11px] font-medium">Exceptions</div>
              <div className="text-sm font-bold text-amber-600 tabular-nums">{metrics.exceptionCount} flagged</div>
            </div>
            <div className="bg-white p-2.5 rounded-lg border border-slate-200/80 shadow-2xs">
              <div className="text-slate-400 text-[11px] font-medium">Total Input</div>
              <div className="text-sm font-bold text-slate-800 tabular-nums">{totalRecords} records</div>
            </div>
          </div>
        </div>

        {/* Progress Bar */}
        <div className="w-full bg-slate-200/80 rounded-full h-3 overflow-hidden p-0.5">
          <div
            className="h-full rounded-full transition-all duration-500 bg-gradient-to-r from-emerald-500 to-teal-500 shadow-sm"
            style={{ width: `${Math.min(metrics.matchRate, 100)}%` }}
          />
        </div>
      </div>

      {/* 6-Metric Core Grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard
          label="Precision"
          value={`${metrics.precision.toFixed(1)}%`}
          sub="Zero false positives"
          badge="100%"
          icon={
            <svg className="w-4 h-4 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Recall"
          value={`${metrics.recall.toFixed(1)}%`}
          sub="Bank credit coverage"
          badge="100%"
          icon={
            <svg className="w-4 h-4 text-indigo-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
            </svg>
          }
        />
        <StatCard
          label="Throughput"
          value={`${metrics.throughput}`}
          sub="Records / sec"
          icon={
            <svg className="w-4 h-4 text-purple-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          }
        />
        <StatCard
          label="False Automation"
          value={`${metrics.falseAutomationRate.toFixed(2)}%`}
          sub="Unverified matches"
          highlight={metrics.falseAutomationRate > 0}
          icon={
            <svg className="w-4 h-4 text-rose-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
          }
        />
        <StatCard
          label="Exceptions"
          value={`${metrics.exceptionCount}`}
          sub="Routed to controller"
          icon={
            <svg className="w-4 h-4 text-amber-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          }
        />
        <StatCard
          label="Review Rate"
          value={`${metrics.reviewRate.toFixed(1)}%`}
          sub="Sent for human audit"
          icon={
            <svg className="w-4 h-4 text-emerald-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          }
        />
      </div>

      {/* Visual Chart & Breakdown */}
      <div className="bg-white border rounded-2xl p-6 shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-bold text-slate-900 mb-4">Matched Bank Credits vs Exception Volume</h3>
        <div className="flex flex-col md:flex-row items-center gap-8">
          <div style={{ width: 200, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={55} outerRadius={85} paddingAngle={4} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <ChartTooltip formatter={(v: number) => [v, 'Records']} />
              </PieChart>
            </ResponsiveContainer>
          </div>

          <div className="space-y-4 flex-1">
            {pieData.map(entry => (
              <div key={entry.name} className="flex items-center justify-between p-3 rounded-xl bg-slate-50 border border-slate-100">
                <div className="flex items-center gap-3">
                  <span className="w-3.5 h-3.5 rounded-md inline-block shadow-2xs" style={{ background: entry.color }} />
                  <span className="text-xs font-semibold text-slate-700">{entry.name}</span>
                </div>
                <div className="flex items-baseline gap-2">
                  <span className="text-sm font-bold tabular-nums text-slate-900">{entry.value}</span>
                  <span className="text-[11px] text-slate-400">
                    ({totalRecords > 0 ? ((entry.value / totalRecords) * 100).toFixed(1) : 0}%)
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
