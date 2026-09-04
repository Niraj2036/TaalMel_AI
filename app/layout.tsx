import type { Metadata } from 'next';
import './globals.css';

export const metadata: Metadata = {
  title: 'TaalMel AI | Enterprise Financial Reconciliation & ICFR Autonomous Engine',
  description: 'AI-driven 3-way financial reconciliation engine with bank credit matching, self-healing double-entry journals, and ICFR audit evidence.',
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className="h-full">
      <body className="h-full flex flex-col antialiased selection:bg-blue-500 selection:text-white" style={{ background: 'var(--background)' }}>
        {/* Top Header */}
        <header className="bg-slate-950 text-white px-5 h-14 flex items-center justify-between border-b border-slate-800/80 shadow-md shrink-0 py-2">
          <div className="flex items-center gap-3">
            {/* Logo Image */}
            <img src="/logo.png" alt="TaalMel AI" className="h-9 w-auto object-contain shrink-0" />
          </div>
        </header>

        <main className="flex-1 overflow-hidden">{children}</main>
      </body>
    </html>
  );
}
