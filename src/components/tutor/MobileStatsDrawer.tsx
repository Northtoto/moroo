'use client';

import { useState, ReactNode } from 'react';

interface ErrorPattern {
  category: string;
  count: number;
}

interface MobileStatsDrawerProps {
  correctionsToday: number;
  accuracy: number;
  errorPatterns: ErrorPattern[];
  children?: ReactNode;
}

export default function MobileStatsDrawer({
  correctionsToday,
  accuracy,
  errorPatterns,
}: MobileStatsDrawerProps) {
  const [isOpen, setIsOpen] = useState(false);

  const topErrors = errorPatterns.slice(0, 3);
  const maxErrCount = topErrors[0]?.count ?? 1;

  return (
    <>
      {/* Mobile stats button - visible on sm:flex, hidden on lg:flex */}
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-6 right-6 sm:flex hidden lg:hidden h-14 w-14 rounded-full shadow-lg transition-all hover:scale-110 z-40"
        style={{
          background: 'var(--amber)',
          color: '#0a0c12',
        }}
        aria-label="Session stats anzeigen"
      >
        <svg
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="w-6 h-6 m-auto"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"
          />
        </svg>
      </button>

      {/* Mobile drawer overlay */}
      {isOpen && (
        <div
          className="fixed inset-0 bg-black/50 z-50 sm:flex hidden lg:hidden"
          onClick={() => setIsOpen(false)}
          style={{ backdropFilter: 'blur(4px)' }}
        />
      )}

      {/* Mobile drawer panel - slides up from bottom */}
      <div
        className={`fixed bottom-0 left-0 right-0 bg-black rounded-t-2xl z-50 sm:flex hidden lg:hidden transition-transform duration-300 max-h-[70vh] overflow-y-auto ${
          isOpen ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          background: 'var(--bg-surface)',
          borderTop: '1px solid var(--glass-border)',
          padding: '24px 16px',
        }}
      >
        {/* Drawer handle */}
        <div className="absolute top-0 left-1/2 transform -translate-x-1/2 -translate-y-1/2 w-12 h-1 rounded-full bg-white/20" />

        {/* Close button */}
        <button
          onClick={() => setIsOpen(false)}
          className="absolute top-4 right-4 p-2 hover:bg-white/10 rounded-lg transition-colors"
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            className="w-5 h-5"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        </button>

        <div className="space-y-6 mt-6 w-full">
          {/* Session stats */}
          <div>
            <p
              className="text-xs font-semibold uppercase tracking-wider mb-3"
              style={{
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-display)',
              }}
            >
              Session
            </p>
            <div className="grid grid-cols-2 gap-3">
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--amber)',
                  }}
                >
                  {correctionsToday}
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Korrektionen
                </p>
              </div>
              <div
                className="rounded-xl p-4 text-center"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                }}
              >
                <p
                  className="text-2xl font-bold"
                  style={{
                    fontFamily: 'var(--font-display)',
                    color: 'var(--success)',
                  }}
                >
                  {accuracy}%
                </p>
                <p className="text-xs mt-1" style={{ color: 'var(--text-muted)' }}>
                  Genauigkeit
                </p>
              </div>
            </div>
          </div>

          {/* Mistake patterns */}
          {topErrors.length > 0 && (
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-wider mb-3"
                style={{
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Fehlermuster
              </p>
              <div className="space-y-3">
                {topErrors.map((err, i) => (
                  <div key={err.category}>
                    <div className="flex items-center justify-between mb-1.5">
                      <span
                        className="text-sm font-medium"
                        style={{ color: 'var(--text-primary)' }}
                      >
                        {err.category}
                      </span>
                      <span
                        className="text-sm font-bold"
                        style={{
                          color: 'var(--amber)',
                          fontFamily: 'var(--font-mono)',
                        }}
                      >
                        ×{err.count}
                      </span>
                    </div>
                    <div
                      className="h-2 rounded-full overflow-hidden"
                      style={{ background: 'rgba(255,255,255,0.06)' }}
                    >
                      <div
                        className="h-full rounded-full transition-all duration-700"
                        style={{
                          width: `${(err.count / maxErrCount) * 100}%`,
                          background:
                            i === 0
                              ? 'linear-gradient(90deg, var(--danger), #f87171)'
                              : i === 1
                              ? 'linear-gradient(90deg, var(--amber), #fbbf24)'
                              : 'linear-gradient(90deg, var(--ice), #93c5fd)',
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}
