'use client';

import { useState } from 'react';

interface UploadPanelProps {
  onReconciliationComplete: (runId: string) => void;
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
    <div className="relative border rounded-lg bg-white overflow-hidden" style={{ borderColor: 'var(--border)' }}>
      <input
        type="file"
        id={id}
        accept=".csv"
        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer z-10"
        onChange={onChange}
      />
      <div className="p-6 flex flex-col items-center justify-center text-center min-h-[140px]">
        {file ? (
          <>
            <svg className="w-8 h-8 mb-2" style={{ color: 'var(--success)' }} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <p className="text-sm font-medium text-slate-700 truncate w-full px-2">{file.name}</p>
            <p className="text-xs text-slate-400 mt-0.5">{(file.size / 1024).toFixed(1)} KB · Click to replace</p>
          </>
        ) : (
          <>
            <svg className="w-7 h-7 mb-2 text-slate-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M19 14l-7 7m0 0l-7-7m7 7V3" />
            </svg>
            <p className="text-sm font-semibold text-slate-700">{label}</p>
            <p className="text-xs text-slate-400 mt-1">{hint}</p>
            <p className="text-xs text-slate-400">Click or drag a CSV file here</p>
          </>
        )}
      </div>
    </div>
  );
}

export function UploadPanel({ onReconciliationComplete }: UploadPanelProps) {
  const [bankFile,    setBankFile]    = useState<File | null>(null);
  const [erpFile,     setErpFile]     = useState<File | null>(null);
  const [gatewayFile, setGatewayFile] = useState<File | null>(null);
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);

  const mkHandler = (setter: (f: File | null) => void) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      if (e.target.files?.[0]) setter(e.target.files[0]);
    };

  const allReady = bankFile && erpFile && gatewayFile;

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
      onReconciliationComplete(data.runId);
    } catch (err: any) {
      setError(err.message || 'Reconciliation failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-3xl mx-auto">
      <div className="mb-6">
        <h1 className="text-xl font-semibold" style={{ color: 'var(--text-primary)' }}>Upload Data Sources</h1>
        <p className="text-sm mt-1" style={{ color: 'var(--text-secondary)' }}>
          Upload all three CSV files to run a full three-way reconciliation batch.
        </p>
      </div>

      {error && (
        <div className="mb-4 px-4 py-3 rounded-md border text-sm" style={{ background: 'var(--danger-light)', borderColor: '#fca5a5', color: 'var(--danger)' }}>
          {error}
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <FileDropZone label="Bank Statement"    hint="Settlement credits & debits"   file={bankFile}    id="bank-file"    onChange={mkHandler(setBankFile)}    />
        <FileDropZone label="ERP Ledger"        hint="Internal accounts-receivable"  file={erpFile}     id="erp-file"     onChange={mkHandler(setErpFile)}     />
        <FileDropZone label="Payment Gateway"   hint="Razorpay gateway settlements"  file={gatewayFile} id="gateway-file" onChange={mkHandler(setGatewayFile)} />
      </div>

      {/* Summary row */}
      <div className="bg-white border rounded-lg p-4 mb-6 flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
        <div className="flex gap-6 text-sm">
          {[
            { label: 'Bank Statement', ok: !!bankFile },
            { label: 'ERP Ledger',     ok: !!erpFile  },
            { label: 'Gateway Data',   ok: !!gatewayFile },
          ].map(({ label, ok }) => (
            <span key={label} className="flex items-center gap-1.5" style={{ color: ok ? 'var(--success)' : 'var(--text-muted)' }}>
              <span>{ok ? '✓' : '○'}</span>
              <span>{label}</span>
            </span>
          ))}
        </div>

        <button
          onClick={handleReconcile}
          disabled={loading || !allReady}
          className="flex items-center gap-2 px-5 py-2 rounded-md text-sm font-medium text-white transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          style={{ background: loading || !allReady ? '#94a3b8' : 'var(--accent)' }}
        >
          {loading ? (
            <>
              <svg className="animate-spin w-4 h-4" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Processing…
            </>
          ) : (
            'Run Reconciliation'
          )}
        </button>
      </div>

      {/* What happens note */}
      <div className="text-xs rounded-md p-4 border" style={{ background: 'var(--accent-light)', borderColor: '#bfdbfe', color: '#1e40af' }}>
        <strong>What happens next:</strong> The engine runs three deterministic passes — exact 1:1 UTR matching, 1:N group matching, then N:M subset-sum solving.
        Unresolved records are routed to the Exception Controller for diagnosis. Results are logged with a full audit trail.
      </div>
    </div>
  );
}
