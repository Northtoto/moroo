'use client';

import { useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { usePathname } from 'next/navigation';

interface ProtectedNavProps {
  displayName: string;
  email: string;
  avatarUrl: string | null;
  totalXp: number;
  level: string;
  streak: number;
}

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
const XP_THRESHOLDS: Record<string, [number, number]> = {
  A1: [0, 100],
  A2: [100, 300],
  B1: [300, 700],
  B2: [700, 1500],
  C1: [1500, 3000],
  C2: [3000, 5000],
};

const NAV_ITEMS = [
  {
    href: '/tutor',
    label: 'KI-Tutor',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
      </svg>
    ),
  },
  {
    href: '/progress',
    label: 'Fortschritt',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
  {
    href: '/league',
    label: 'Liga',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4M7.835 4.697a3.42 3.42 0 001.946-.806 3.42 3.42 0 014.438 0 3.42 3.42 0 001.946.806 3.42 3.42 0 013.138 3.138 3.42 3.42 0 00.806 1.946 3.42 3.42 0 010 4.438 3.42 3.42 0 00-.806 1.946 3.42 3.42 0 01-3.138 3.138 3.42 3.42 0 00-1.946.806 3.42 3.42 0 01-4.438 0 3.42 3.42 0 00-1.946-.806 3.42 3.42 0 01-3.138-3.138 3.42 3.42 0 00-.806-1.946 3.42 3.42 0 010-4.438 3.42 3.42 0 00.806-1.946 3.42 3.42 0 013.138-3.138z" />
      </svg>
    ),
  },
  {
    href: '/certificate',
    label: 'Zertifikat',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M4.26 10.147a60.438 60.438 0 00-.491 6.347A48.62 48.62 0 0112 20.904a48.62 48.62 0 018.232-4.41 60.46 60.46 0 00-.491-6.347m-15.482 0a50.636 50.636 0 00-2.658-.813A59.906 59.906 0 0112 3.493a59.903 59.903 0 0110.399 5.84c-.896.248-1.783.52-2.658.814m-15.482 0A50.717 50.717 0 0112 13.489a50.702 50.702 0 017.74-3.342M6.75 15a.75.75 0 100-1.5.75.75 0 000 1.5zm0 0v-3.675A55.378 55.378 0 0112 8.443m-7.007 11.55A5.981 5.981 0 006.75 15.75v-1.5" />
      </svg>
    ),
  },
  {
    href: '/flashcards',
    label: 'Vokabeln',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
      </svg>
    ),
  },
  {
    href: '/tutor/voice',
    label: 'Stimme',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
      </svg>
    ),
  },
  {
    href: '/lesen',
    label: 'Lesen',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 20H5a2 2 0 01-2-2V6a2 2 0 012-2h10a2 2 0 012 2v1m2 13a2 2 0 01-2-2V7m2 13a2 2 0 002-2V9a2 2 0 00-2-2h-2m-4-3H9M7 16h6M7 8h6v4H7V8z" />
      </svg>
    ),
  },
  {
    href: '/pricing',
    label: 'Upgrade',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
      </svg>
    ),
  },
  {
    href: '/profile',
    label: 'Profil',
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-5 h-5">
        <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
      </svg>
    ),
  },
];

function cefrProgress(level: string, totalXp: number): number {
  const thresholds = XP_THRESHOLDS[level] ?? [0, 100];
  const [min, max] = thresholds;
  return Math.min(100, Math.max(0, ((totalXp - min) / (max - min)) * 100));
}

function cefrClass(level: string): string {
  const map: Record<string, string> = {
    A1: 'cefr-a1', A2: 'cefr-a2',
    B1: 'cefr-b1', B2: 'cefr-b2',
    C1: 'cefr-c1', C2: 'cefr-c2',
  };
  return map[level] ?? 'cefr-a1';
}

export default function ProtectedNav({
  displayName, email, avatarUrl, totalXp, level, streak,
}: ProtectedNavProps) {
  const pathname = usePathname();
  const [collapsed, setCollapsed] = useState(false);
  const xpPct = cefrProgress(level, totalXp);
  const nextLevel = CEFR_LEVELS[CEFR_LEVELS.indexOf(level) + 1] ?? 'MAX';

  return (
    <aside
      className="flex flex-col shrink-0 transition-all duration-300"
      style={{
        width: collapsed ? '72px' : '240px',
        background: 'var(--bg-surface)',
        borderRight: '1px solid var(--glass-border)',
        minHeight: '100vh',
        position: 'sticky',
        top: 0,
        height: '100vh',
        overflowY: 'auto',
        overflowX: 'hidden',
      }}
    >
      {/* Logo */}
      <div className="flex items-center justify-between px-4 pt-5 pb-4">
        {collapsed ? (
          /* Collapsed: show 3 German-flag dots */
          <div style={{ display: 'flex', flexDirection: 'column', gap: 3, margin: '0 auto' }}>
            {(['#1a1a1a', '#ef4444', '#f59e0b'] as const).map((c) => (
              <div key={c} style={{ width: 8, height: 8, borderRadius: '50%', background: c }} />
            ))}
          </div>
        ) : (
          <div style={{
            background: '#fff',
            borderRadius: 8,
            padding: '4px 8px',
            display: 'inline-flex',
            alignItems: 'center',
          }}>
            <Image
              src="/logo.jpeg"
              alt="Marodeutsch"
              width={80}
              height={28}
              style={{ height: 28, width: 'auto', display: 'block' }}
            />
          </div>
        )}
        <button
          onClick={() => setCollapsed((c) => !c)}
          className="p-1.5 rounded-lg transition-colors hover:bg-white/10 ml-auto"
          style={{ color: 'var(--text-muted)', flexShrink: 0 }}
          aria-label="Toggle sidebar"
        >
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
            {collapsed
              ? <path strokeLinecap="round" strokeLinejoin="round" d="M13 5l7 7-7 7M5 5l7 7-7 7" />
              : <path strokeLinecap="round" strokeLinejoin="round" d="M11 19l-7-7 7-7m8 14l-7-7 7-7" />
            }
          </svg>
        </button>
      </div>

      {/* User card */}
      <div className="mx-3 mb-4 p-3 rounded-2xl glass">
        <div className="flex items-center gap-3">
          <div
            className="shrink-0 flex items-center justify-center rounded-full text-sm font-bold"
            style={{
              width: 40, height: 40,
              background: 'linear-gradient(135deg, var(--amber), #fbbf24)',
              color: '#0a0c12',
              fontFamily: 'var(--font-display)',
            }}
          >
            {avatarUrl ? (
              <Image src={avatarUrl} alt={displayName} width={40} height={40} className="w-10 h-10 rounded-full object-cover" unoptimized />
            ) : (
              displayName.charAt(0).toUpperCase()
            )}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-sm font-semibold truncate" style={{ color: 'var(--text-primary)' }}>
                {displayName}
              </p>
              <p className="text-xs truncate" style={{ color: 'var(--text-muted)' }}>{email}</p>
            </div>
          )}
        </div>

        {/* XP bar */}
        {!collapsed && (
          <div className="mt-3">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs" style={{ color: 'var(--text-muted)' }}>
                {totalXp.toLocaleString()} XP
              </span>
              <span
                className={`text-xs font-bold px-1.5 py-0.5 rounded-full ${cefrClass(level)}`}
                style={{ fontSize: '10px' }}
              >
                {level}
              </span>
            </div>
            <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
              <div
                className="xp-bar-fill h-full"
                style={{ width: `${xpPct}%` }}
              />
            </div>
            <p className="text-xs mt-1" style={{ color: 'var(--text-muted)', fontSize: '10px' }}>
              → {nextLevel}
            </p>
          </div>
        )}
      </div>

      {/* Streak */}
      <div className="mx-3 mb-4 px-3 py-2.5 rounded-xl glass-amber flex items-center gap-2.5">
        <span className="text-xl animate-fire">🔥</span>
        {!collapsed && (
          <div>
            <p className="text-sm font-bold" style={{ color: 'var(--amber)' }}>
              {streak} {streak === 1 ? 'Tag' : 'Tage'}
            </p>
            <p className="text-xs" style={{ color: 'var(--text-muted)' }}>Aktuelle Serie</p>
          </div>
        )}
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const active = pathname === item.href || pathname.startsWith(item.href + '/');
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex items-center gap-3 px-3 py-2.5 rounded-xl transition-all duration-200 group"
              style={{
                background: active ? 'var(--amber-glow)' : 'transparent',
                color: active ? 'var(--amber)' : 'var(--text-muted)',
                border: active ? '1px solid rgba(245,158,11,0.20)' : '1px solid transparent',
              }}
            >
              <span className="shrink-0">{item.icon}</span>
              {!collapsed && (
                <span className="text-sm font-medium">{item.label}</span>
              )}
            </Link>
          );
        })}
      </nav>

      {/* Weekly challenge */}
      {!collapsed && (
        <div
          className="mx-3 my-4 p-3 rounded-xl cursor-pointer transition-all hover:scale-[1.02]"
          style={{
            background: 'linear-gradient(135deg, rgba(245,158,11,0.15), rgba(186,230,253,0.08))',
            border: '1px solid rgba(245,158,11,0.20)',
          }}
        >
          <p className="text-xs font-bold mb-0.5" style={{ color: 'var(--amber)' }}>
            ⚡ Wochenaufgabe
          </p>
          <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
            10 Korrekturen heute
          </p>
          <div className="mt-2 h-1 rounded-full overflow-hidden" style={{ background: 'rgba(255,255,255,0.08)' }}>
            <div className="xp-bar-fill h-full" style={{ width: '40%' }} />
          </div>
        </div>
      )}

      {/* Sign out */}
      <div className="px-3 pb-5">
        <form action="/auth/signout" method="post">
          <button
            type="submit"
            className="flex items-center gap-2 px-3 py-2 rounded-xl w-full transition-colors hover:bg-white/5"
            style={{ color: 'var(--text-muted)', fontSize: '13px' }}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4 shrink-0">
              <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
            </svg>
            {!collapsed && <span>Abmelden</span>}
          </button>
        </form>
      </div>
    </aside>
  );
}
