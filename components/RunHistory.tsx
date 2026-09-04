'use client';

import { useState, useEffect } from 'react';

interface RunHistoryProps {
  onSelectRun: (runId: string) => void;
}

interface RunRecord {
  id: string;
  date: string;
  totalRecords: number;
  matchRate: number;
  status: 'COMPLETED' | 'FAILED' | 'IN_PROGRESS';
  exceptionCount?: number;
}

function MatchBar({ rate }: { rate: number }) {
  const color = rate > 80 ? 'var(--success)' : rate > 60 ? 'var(--warning)' : 'var(--danger)';
  return (
    <div className="flex items-center gap-2">
      <div className="w-16 bg-slate-100 rounded-full h-1.5">
        <div className="h-1.5 rounded-full" style={{ width: `${Math.min(rate, 100)}%`, background: color }} />
      </div>
      <span className="text-xs tabular-nums font-medium" style={{ color }}>{rate.toFixed(1)}%</span>
    </div>
  );
}

const STATUS_MAP: Record<string, { label: string; bg: string; text: string }> = {
  COMPLETED:   { label: 'Completed',   bg: 'var(--success-light)', text: 'var(--success)' },
  FAILED:      { label: 'Failed',      bg: 'var(--danger-light)',  text: 'var(--danger)'  },
  IN_PROGRESS: { label: 'In Progress', bg: 'var(--accent-light)',  text: 'var(--accent)'  },
};

export function RunHistory({ onSelectRun }: RunHistoryProps) {
  const [runs,    setRuns]    = useState<RunRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/runs')
      .then(r => { if (!r.ok) throw new Error('Failed to load'); return r.json(); })
      .then(setRuns)
      .catch((e: Error) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className="flex justify-center py-16">
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

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Run History</h1>
        <p className="text-xs mt-0.5" style={{ color: 'var(--text-muted)' }}>{runs.length} run{runs.length !== 1 ? 's' : ''} · Click a row to load metrics</p>
      </div>

      {runs.length === 0 ? (
        <div className="bg-white border rounded-lg p-10 text-center text-sm" style={{ borderColor: 'var(--border)', color: 'var(--text-muted)' }}>
          No previous runs. Go to <strong>Upload & Run</strong> to start a reconciliation.
        </div>
      ) : (
        <div className="bg-white border rounded-lg overflow-hidden" style={{ borderColor: 'var(--border)' }}>
          <table className="w-full text-sm text-left">
            <thead style={{ background: '#f8fafc', borderBottom: '1px solid var(--border)' }}>
              <tr>
                {['Run ID', 'Date', 'Records', 'Match Rate', 'Exceptions', 'Status'].map(h => (
                  <th key={h} className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide" style={{ color: 'var(--text-secondary)' }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {runs.map((run, idx) => {
                const st = STATUS_MAP[run.status] ?? STATUS_MAP.COMPLETED;
                return (
                  <tr
                    key={run.id}
                    onClick={() => onSelectRun(run.id)}
                    className="border-t cursor-pointer hover:bg-slate-50 transition-colors"
                    style={{ borderColor: idx === 0 ? 'transparent' : 'var(--border)' }}
                  >
                    <td className="px-4 py-3 font-mono text-xs" style={{ color: 'var(--text-secondary)' }}>
                      {run.id.slice(0, 8)}…{run.id.slice(-4)}
                    </td>
                    <td className="px-4 py-3 text-xs" style={{ color: 'var(--text-primary)' }}>
                      {new Date(run.date).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}
                    </td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: 'var(--text-primary)' }}>{run.totalRecords}</td>
                    <td className="px-4 py-3"><MatchBar rate={run.matchRate} /></td>
                    <td className="px-4 py-3 text-xs tabular-nums" style={{ color: run.exceptionCount ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {run.exceptionCount ?? '—'}
                    </td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 rounded text-xs font-medium" style={{ background: st.bg, color: st.text }}>
                        {st.label}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
