'use client';

import { useEffect, useState } from 'react';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip as ChartTooltip } from 'recharts';

interface MetricsPanelProps { runId: string | null; }

interface MetricsData {
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

function StatCard({ label, value, sub, highlight }: { label: string; value: string; sub: string; highlight?: boolean }) {
  return (
    <div className="bg-white border rounded-lg p-4" style={{ borderColor: 'var(--border)' }}>
      <div className="text-xs font-medium mb-2" style={{ color: 'var(--text-secondary)' }}>{label}</div>
      <div
        className="text-2xl font-semibold tabular-nums"
        style={{ color: highlight ? 'var(--danger)' : 'var(--text-primary)' }}
      >
        {value}
      </div>
      <div className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>{sub}</div>
    </div>
  );
}

export function MetricsPanel({ runId }: MetricsPanelProps) {
  const [metrics, setMetrics] = useState<MetricsData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    if (!runId) return;
    setLoading(true);
    setError(null);
    fetch(`/api/metrics/${runId}`)
      .then(r => { if (!r.ok) throw new Error('Failed to load metrics'); return r.json(); })
      .then(setMetrics)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, [runId]);

  if (!runId) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center" style={{ color: 'var(--text-muted)' }}>
        <svg className="w-12 h-12 mb-4 text-slate-200" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
        </svg>
        <p className="text-sm font-medium text-slate-500">No run selected</p>
        <p className="text-xs mt-1 text-slate-400">Run a reconciliation to view metrics here.</p>
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

  if (error || !metrics) {
    return (
      <div className="px-4 py-3 rounded-md border text-sm" style={{ background: 'var(--danger-light)', borderColor: '#fca5a5', color: 'var(--danger)' }}>
        {error || 'No data available.'}
      </div>
    );
  }

  const matchedCount   = metrics.matchedCount ?? 0;
  const totalRecords   = metrics.totalRecords ?? 0;
  const pieData = [
    { name: 'Matched Bank Credits', value: matchedCount, color: '#16a34a' },
    { name: 'Exceptions Flagged',   value: metrics.exceptionCount, color: '#d97706' },
  ];

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Reconciliation Results</h1>
          <p className="text-xs mt-0.5 font-mono" style={{ color: 'var(--text-muted)' }}>Run: {runId}</p>
        </div>
        <div
          className="text-xs px-3 py-1.5 rounded border font-medium"
          style={{
            background: metrics.matchRate > 80 ? 'var(--success-light)' : 'var(--warning-light)',
            borderColor: metrics.matchRate > 80 ? '#86efac' : '#fde68a',
            color:       metrics.matchRate > 80 ? 'var(--success)' : 'var(--warning)',
          }}
        >
          {metrics.matchRate > 80 ? 'Good' : 'Review required'} · {metrics.matchRate.toFixed(1)}% bank match rate
        </div>
      </div>

      {/* Match Rate Bar */}
      <div className="bg-white border rounded-lg p-5" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-end justify-between mb-3">
          <div>
            <div className="text-xs font-medium mb-1" style={{ color: 'var(--text-secondary)' }}>Bank Statement Reconciliation Rate</div>
            <div className="text-4xl font-semibold tabular-nums" style={{ color: 'var(--text-primary)' }}>
              {metrics.matchRate.toFixed(1)}<span className="text-xl text-slate-400">%</span>
            </div>
          </div>
          <div className="text-right text-xs space-y-0.5" style={{ color: 'var(--text-muted)' }}>
            <div className="font-medium text-slate-700">{matchedCount} bank credits reconciled</div>
            <div>{metrics.exceptionCount} total exceptions flagged</div>
            <div>{totalRecords} total records across ERP, Gateway, Bank</div>
          </div>
        </div>
        <div className="w-full bg-slate-100 rounded-full h-2">
          <div
            className="h-2 rounded-full transition-all"
            style={{
              width: `${Math.min(metrics.matchRate, 100)}%`,
              background: metrics.matchRate > 80 ? 'var(--success)' : metrics.matchRate > 60 ? 'var(--warning)' : 'var(--danger)',
            }}
          />
        </div>
      </div>

      {/* Metric grid */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
        <StatCard label="Precision"        value={`${metrics.precision.toFixed(1)}%`}        sub="True positive rate" />
        <StatCard label="Recall"           value={`${metrics.recall.toFixed(1)}%`}           sub="Coverage of matches" />
        <StatCard label="Throughput"       value={`${metrics.throughput}`}                   sub="Records / sec" />
        <StatCard label="False Automation" value={`${metrics.falseAutomationRate.toFixed(2)}%`} sub="Incorrect auto-matches" highlight={metrics.falseAutomationRate > 0} />
        <StatCard label="Exceptions"       value={`${metrics.exceptionCount}`}               sub="Need review" />
        <StatCard label="Review Rate"      value={`${metrics.reviewRate.toFixed(1)}%`}       sub="Sent for human review" />
      </div>

      {/* Chart */}
      <div className="bg-white border rounded-lg p-5" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-sm font-semibold mb-4" style={{ color: 'var(--text-primary)' }}>Matched vs Exceptions</h3>
        <div className="flex items-center gap-8">
          <div style={{ width: 160, height: 160 }}>
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} cx="50%" cy="50%" innerRadius={45} outerRadius={70} paddingAngle={3} dataKey="value">
                  {pieData.map((entry, i) => <Cell key={i} fill={entry.color} />)}
                </Pie>
                <ChartTooltip formatter={(v: number) => [v, '']} />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="space-y-3">
            {pieData.map(entry => (
              <div key={entry.name} className="flex items-center gap-3">
                <span className="w-3 h-3 rounded-sm inline-block flex-shrink-0" style={{ background: entry.color }} />
                <span className="text-sm" style={{ color: 'var(--text-secondary)' }}>{entry.name}</span>
                <span className="text-sm font-semibold tabular-nums ml-auto" style={{ color: 'var(--text-primary)' }}>{entry.value}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
