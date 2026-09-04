'use client';

import { useState } from 'react';
import { UploadPanel } from '@/components/UploadPanel';
import { MetricsPanel, MetricsData } from '@/components/MetricsPanel';
import { MatchList } from '@/components/MatchList';
import { ExceptionList } from '@/components/ExceptionList';
import { ChatAgent } from '@/components/ChatAgent';

type Tab = 'upload' | 'dashboard' | 'matches' | 'exceptions' | 'agent';

interface NavItem {
  id: Tab;
  label: string;
  badge?: string;
  icon: (active: boolean) => React.ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  {
    id: 'upload',
    label: 'Upload & Run Batch',
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
      </svg>
    ),
  },
  {
    id: 'dashboard',
    label: 'Reconciliation Metrics',
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    id: 'matches',
    label: 'Matched Records',
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
      </svg>
    ),
  },
  {
    id: 'exceptions',
    label: 'Exceptions & Proposals',
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
      </svg>
    ),
  },
  {
    id: 'agent',
    label: 'TaalMel AI Copilot',
    badge: 'AI',
    icon: (active) => (
      <svg className={`w-4 h-4 ${active ? 'text-blue-600' : 'text-slate-400'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);
  const [metricsMap, setMetricsMap] = useState<Record<string, MetricsData>>({});

  const handleReconciliationComplete = (runId: string, initialMetrics?: MetricsData) => {
    if (initialMetrics) {
      setMetricsMap(prev => ({ ...prev, [runId]: initialMetrics }));
    }
    setCurrentRunId(runId);
    setActiveTab('dashboard');
  };

  return (
    <div className="flex h-full bg-slate-50">
      {/* Sidebar Navigation */}
      <aside className="w-60 bg-white border-r shrink-0 flex flex-col justify-between shadow-sm" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3.5 space-y-1">
          <div className="px-3 py-2 text-[11px] font-semibold text-slate-400 uppercase tracking-wider">
            Reconciliation Workspace
          </div>
          {NAV_ITEMS.map((item) => {
            const active = activeTab === item.id;
            return (
              <button
                key={item.id}
                onClick={() => setActiveTab(item.id)}
                className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg text-xs font-semibold transition-all duration-150 ${
                  active
                    ? 'bg-blue-50/80 text-blue-700 shadow-sm border border-blue-200/60'
                    : 'text-slate-600 hover:bg-slate-100/70 hover:text-slate-900 border border-transparent'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  {item.icon(active)}
                  <span>{item.label}</span>
                </div>
                {item.badge && (
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold uppercase ${
                    active ? 'bg-blue-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}>
                    {item.badge}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {/* Active Run Status Widget */}
        <div className="p-3.5 border-t bg-slate-50/70" style={{ borderColor: 'var(--border)' }}>
          {currentRunId ? (
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <span className="font-semibold text-slate-500">Active Batch Run</span>
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-semibold bg-emerald-100 text-emerald-800">
                  COMPLETED
                </span>
              </div>
              <div className="font-mono text-[11px] text-slate-700 bg-white px-2 py-1.5 rounded border border-slate-200 truncate select-all">
                {currentRunId}
              </div>
              <div className="text-[10px] text-slate-400 flex items-center gap-1">
                <span>✓ Data indexed in memory & DB</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-2 text-slate-400 text-xs">
              <p className="font-medium text-slate-500">No active batch</p>
              <p className="text-[11px] mt-0.5">Upload CSVs to trigger matching</p>
            </div>
          )}
        </div>
      </aside>

      {/* Main Content Area */}
      <div className="flex-1 overflow-auto p-6 bg-slate-50/50">
        {activeTab === 'upload' && (
          <UploadPanel onReconciliationComplete={handleReconciliationComplete} />
        )}
        {activeTab === 'dashboard' && (
          <MetricsPanel
            runId={currentRunId}
            initialMetrics={currentRunId ? metricsMap[currentRunId] : undefined}
          />
        )}
        {activeTab === 'matches'    && <MatchList runId={currentRunId} />}
        {activeTab === 'exceptions' && <ExceptionList runId={currentRunId} />}
        {activeTab === 'agent'      && <ChatAgent runId={currentRunId} />}
      </div>
    </div>
  );
}
