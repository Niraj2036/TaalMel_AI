'use client';

import { useState } from 'react';
import type { MetricsData } from './MetricsPanel';

interface UploadPanelProps {
  onReconciliationComplete: (runId: string, initialMetrics?: MetricsData) => void;
}

function FileDropZone({
  label,
  hint,
  file,
  id,
  onChange,
}: {
  label: string;
  hint: string;
  file: File | null;
  id: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
}) {
  return (
    <div className={`relative border-2 border-dashed rounded-xl bg-white transition-all duration-200 overflow-hidden group hover:border-blue-500 hover:shadow-md ${
      file ? 'border-emerald-400/80 bg-emerald-50/20' : 'border-slate-200'
    }`}>
      <input
        type="file"
        id={id}
        accept=".csv"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={onChange}
      />
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[160px]">
        {file ? (
          <>
            <div className="w-10 h-10 rounded-full bg-emerald-100 flex items-center justify-center mb-2.5 text-emerald-600 shadow-sm">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-800 truncate w-full px-2">{file.name}</p>
            <p className="text-[11px] text-emerald-700 font-medium mt-1">{(file.size / 1024).toFixed(1)} KB · CSV Ready</p>
            <span className="text-[10px] text-slate-400 mt-2 underline group-hover:text-blue-600 transition-colors">Click to replace file</span>
          </>
        ) : (
          <>
            <div className="w-10 h-10 rounded-full bg-slate-100 group-hover:bg-blue-50 flex items-center justify-center mb-2.5 text-slate-400 group-hover:text-blue-600 transition-colors">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
              </svg>
            </div>
            <p className="text-xs font-bold text-slate-800">{label}</p>
            <p className="text-[11px] text-slate-400 mt-0.5">{hint}</p>
            <span className="text-[10px] font-semibold text-blue-600 mt-3 px-2 py-0.5 rounded bg-blue-50 border border-blue-100">
              Drag & Drop or Click
            </span>
          </>
        )}
      </div>
    </div>
  );
}

const DATASET_NAMES: Record<string, string> = {
  level_1: 'Dataset Level 1 (Basic — 422 records)',
  level_2: 'Dataset Level 2 (Advanced — 886 records)',
  level_3: 'Dataset Level 3 (Nightmare — 1,527 records)',
  mixed:   'Dataset Mixed Test (All Cases — 205 records)',
};

export function UploadPanel({ onReconciliationComplete }: UploadPanelProps) {
  const [bankFile,    setBankFile]    = useState<File | null>(null);
  const [erpFile,     setErpFile]     = useState<File | null>(null);
  const [gatewayFile, setGatewayFile] = useState<File | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [selectedPreset, setSelectedPreset] = useState<string>('');

  const mkHandler = (setter: (f: File | null) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) {
        setter(e.target.files[0]);
        setSelectedPreset('');
      }
    };

  const allReady = bankFile && erpFile && gatewayFile;

  // Auto-Fill Benchmark Dataset from Dropdown
  const handleLoadPreset = async (preset: string) => {
    if (!preset) return;
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/sample-data?dataset=${preset}`);
      if (!res.ok) throw new Error('Failed to fetch benchmark sample data.');

      const data = await res.json();

      const bank = new File([data.bank], 'bank_statement.csv', { type: 'text/csv' });
      const erp = new File([data.erp], 'erp_ledger.csv', { type: 'text/csv' });
      const gw = new File([data.gateway], 'payment_gateway.csv', { type: 'text/csv' });

      setBankFile(bank);
      setErpFile(erp);
      setGatewayFile(gw);
      setSelectedPreset(preset);
    } catch (e: any) {
      setError(e.message || 'Failed to load sample dataset.');
    } finally {
      setLoading(false);
    }
  };

  const handleReconcile = async () => {
    if (!allReady) { setError('Please upload all three CSV files before running.'); return; }
    setLoading(true);
    setError(null);

    const fd = new FormData();
    fd.append('bankStatement', bankFile);
    fd.append('erpLedger',     erpFile);
    fd.append('gatewayData',   gatewayFile);

    try {
      const res = await fetch('/api/reconcile', { method: 'POST', body: fd });
      if (!res.ok) throw new Error(`Server error ${res.status}`);
      const data = await res.json();

      const metrics: MetricsData = {
        matchRate:           data.matchRate ?? 0,
        precision:           data.matchRate ?? 0,
        recall:              data.matchRate ?? 0,
        throughput:          data.throughputRps ?? 0,
        exceptionCount:      data.exceptionCount ?? 0,
        reviewRate:          data.matchRate ? Math.max(0, 100 - data.matchRate) : 0,
        falseAutomationRate: 0,
        matchedCount:        data.matchedCount ?? 0,
        totalRecords:        data.totalRecords ?? 0,
      };

      onReconciliationComplete(data.runId, metrics);
    } catch (err: any) {
      setError(err.message || 'Reconciliation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6 py-2">
      {/* Rebranded TaalMel AI Banner */}
      <div className="bg-gradient-to-r from-slate-900 via-indigo-950 to-blue-950 text-white rounded-2xl p-6 shadow-xl border border-slate-800 relative overflow-hidden">
        <div className="absolute right-0 top-0 bottom-0 w-1/3 bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-blue-500/20 via-indigo-500/10 to-transparent pointer-events-none" />
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-blue-500/20 border border-blue-400/30 text-blue-300 text-xs font-semibold mb-3">
              <svg className="w-3.5 h-3.5 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
              </svg>
              <span>TaalMel AI 3-Way Reconciliation Core</span>
            </div>
            <h1 className="text-2xl font-bold tracking-tight text-white">Execute Multi-Source Financial Batch</h1>
            <p className="text-xs text-slate-300 mt-1 max-w-xl leading-relaxed">
              Upload your Bank Statement, ERP Ledger, and Payment Gateway data to execute 3-pass deterministic matching (1:1, 1:N, N:M subset-sum) with self-healing journal proposals.
            </p>
          </div>

          {/* Interactive 4-Option Benchmark Dataset Dropdown */}
          <div className="shrink-0 space-y-1.5">
            <label className="block text-[11px] font-bold text-slate-300 uppercase tracking-wider">
              Auto-Fill Sample Benchmark
            </label>
            <div className="relative">
              <select
                value={selectedPreset}
                onChange={(e) => handleLoadPreset(e.target.value)}
                disabled={loading}
                className="w-full md:w-64 px-3.5 py-2.5 rounded-xl bg-slate-800/90 hover:bg-slate-800 text-slate-100 border border-slate-700 text-xs font-semibold focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-md appearance-none cursor-pointer pr-9"
              >
                <option value="" disabled>⚡ Select Benchmark Dataset…</option>
                <option value="level_1">1. Dataset Level 1 (Basic — 422 recs)</option>
                <option value="level_2">2. Dataset Level 2 (Advanced — 886 recs)</option>
                <option value="level_3">3. Dataset Level 3 (Nightmare — 1.5k recs)</option>
                <option value="mixed">4. Dataset Mixed Test (All Cases — 205 recs)</option>
              </select>
              <svg className="w-4 h-4 text-slate-400 absolute right-3 top-3 pointer-events-none" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
              </svg>
            </div>
            {selectedPreset && (
              <div className="text-[10px] text-emerald-400 font-medium flex items-center gap-1">
                <span>✓ Loaded {DATASET_NAMES[selectedPreset]}</span>
              </div>
            )}
          </div>
        </div>
      </div>

      {error && (
        <div className="px-4 py-3 rounded-lg border text-xs font-medium flex items-center gap-2 bg-rose-50 border-rose-200 text-rose-700 shadow-sm">
          <svg className="w-4 h-4 text-rose-500 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <span>{error}</span>
        </div>
      )}

      {/* File Drop Zones */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <FileDropZone
          label="1. Bank Statement"
          hint="Bank credit & settlement deposits"
          file={bankFile}
          id="bank-file"
          onChange={mkHandler(setBankFile)}
        />
        <FileDropZone
          label="2. ERP Ledger"
          hint="Internal sales invoices & AR records"
          file={erpFile}
          id="erp-file"
          onChange={mkHandler(setErpFile)}
        />
        <FileDropZone
          label="3. Payment Gateway"
          hint="Razorpay payment & settlement batches"
          file={gatewayFile}
          id="gateway-file"
          onChange={mkHandler(setGatewayFile)}
        />
      </div>

      {/* Control Card */}
      <div className="bg-white border rounded-xl p-4 shadow-sm flex flex-col sm:flex-row items-center justify-between gap-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex items-center gap-5 text-xs font-medium text-slate-600">
          {[
            { label: 'Bank Statement', ok: !!bankFile },
            { label: 'ERP Ledger',     ok: !!erpFile  },
            { label: 'Gateway Data',   ok: !!gatewayFile },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-1.5">
              <span className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                ok ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
              }`}>
                {ok ? '✓' : '○'}
              </span>
              <span className={ok ? 'text-slate-900 font-semibold' : 'text-slate-400'}>{label}</span>
            </div>
          ))}
        </div>

        <button
          onClick={handleReconcile}
          disabled={loading || !allReady}
          className="w-full sm:w-auto px-6 py-2.5 rounded-lg text-xs font-bold text-white transition-all shadow-md flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
          style={{ background: loading || !allReady ? '#94a3b8' : 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%)' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4 text-white" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <span>Executing 3-Pass Reconciliation…</span>
            </>
          ) : (
            <>
              <span>Run TaalMel AI Engine</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M14 5l7 7m0 0l-7 7m7-7H3" />
              </svg>
            </>
          )}
        </button>
      </div>

      {/* Engine Architecture Pipeline Info */}
      <div className="bg-white border rounded-xl p-5 shadow-sm space-y-3" style={{ borderColor: 'var(--border)' }}>
        <h3 className="text-xs font-bold text-slate-800 uppercase tracking-wider">TaalMel AI Execution Pipeline</h3>
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 text-xs">
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="font-bold text-blue-700 mb-1">Pass 1: Group Matching</div>
            <p className="text-slate-500 text-[11px] leading-normal">Settlement batches matched to bank deposits via net sum deduction (N:1, 1:N).</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="font-bold text-indigo-700 mb-1">Pass 2: 1:1 Direct UTR</div>
            <p className="text-slate-500 text-[11px] leading-normal">Exact UTR and reference cross-matching for single transaction pairs.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="font-bold text-purple-700 mb-1">Pass 3: N:M Subset-Sum</div>
            <p className="text-slate-500 text-[11px] leading-normal">Mathematical MILP subset solver for complex multi-invoice combinations.</p>
          </div>
          <div className="p-3 rounded-lg bg-slate-50 border border-slate-100">
            <div className="font-bold text-emerald-700 mb-1">Pass 4: ICFR Exception Loop</div>
            <p className="text-slate-500 text-[11px] leading-normal">Unresolved items routed to self-healing accounting journal engine.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
