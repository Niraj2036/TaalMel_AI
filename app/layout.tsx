import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'Finance Reconciliation Engine | Razorpay Buildithon',
  description: 'Evidence-driven reconciliation with deterministic matching and honest exception reporting',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen" style={{ background: 'var(--background)' }}>
        {/* Top Navigation */}
        <nav style={{ background: 'var(--nav-bg)' }} className="text-white px-6 h-12 flex items-center justify-between border-b border-slate-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2.5">
              {/* Razorpay-style logotype mark */}
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
                <path d="M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5" stroke="#3b82f6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
              </svg>
              <span className="text-sm font-semibold tracking-tight">Finance Reconciliation Engine</span>
            </div>
            <span className="text-slate-500 text-xs">|</span>
            <span className="text-slate-400 text-xs">Razorpay Buildithon · Track 4</span>
          </div>
          <div className="flex items-center gap-3 text-xs text-slate-400">
            <span className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 inline-block"></span>
              Engine online
            </span>
          </div>
        </nav>
        <main>{children}</main>
      </body>
    </html>
  );
}
