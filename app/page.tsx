'use client';

import { useState } from 'react';
import { UploadPanel } from '@/components/UploadPanel';
import { MetricsPanel } from '@/components/MetricsPanel';
import { MatchList } from '@/components/MatchList';
import { ExceptionList } from '@/components/ExceptionList';
import { ChatAgent } from '@/components/ChatAgent';
import { RunHistory } from '@/components/RunHistory';

type Tab = 'upload' | 'dashboard' | 'matches' | 'exceptions' | 'agent' | 'history';

const NAV_ITEMS: { id: Tab; label: string }[] = [
  { id: 'upload',     label: 'Upload & Run'     },
  { id: 'dashboard',  label: 'Metrics'          },
  { id: 'matches',    label: 'Matched Records'  },
  { id: 'exceptions', label: 'Exceptions'       },
  { id: 'agent',      label: 'Query Assistant'  },
  { id: 'history',    label: 'Run History'      },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState<Tab>('upload');
  const [currentRunId, setCurrentRunId] = useState<string | null>(null);

  return (
    <div className="flex" style={{ height: 'calc(100vh - 48px)' }}>
      {/* Sidebar */}
      <aside className="w-48 bg-white border-r shrink-0 flex flex-col" style={{ borderColor: 'var(--border)' }}>
        <div className="p-3 pt-4 space-y-0.5 flex-1">
          {NAV_ITEMS.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveTab(item.id)}
              className={`w-full text-left px-3 py-2 rounded text-sm transition-colors font-medium ${
                activeTab === item.id
                  ? 'bg-blue-50 text-blue-700'
                  : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>

        {currentRunId && (
          <div className="p-3 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs text-slate-400 mb-1">Active run</div>
            <div className="text-xs font-mono text-slate-600 truncate">{currentRunId.slice(0, 16)}…</div>
          </div>
        )}
      </aside>

      {/* Main content */}
      <div className="flex-1 overflow-auto p-6">
        {activeTab === 'upload' && (
          <UploadPanel
            onReconciliationComplete={(runId) => {
              setCurrentRunId(runId);
              setActiveTab('dashboard');
            }}
          />
        )}
        {activeTab === 'dashboard'  && <MetricsPanel runId={currentRunId} />}
        {activeTab === 'matches'    && <MatchList runId={currentRunId} />}
        {activeTab === 'exceptions' && <ExceptionList runId={currentRunId} />}
        {activeTab === 'agent'      && <ChatAgent runId={currentRunId} />}
        {activeTab === 'history'    && (
          <RunHistory
            onSelectRun={(runId) => {
              setCurrentRunId(runId);
              setActiveTab('dashboard');
            }}
          />
        )}
      </div>
    </div>
  );
}
