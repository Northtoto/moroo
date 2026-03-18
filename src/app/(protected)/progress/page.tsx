'use client';

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  ResponsiveContainer,
} from 'recharts';

// ─── Types ────────────────────────────────────────────────────────────────────

interface XpData {
  total_xp: number;
  level: string;
}

interface StreakData {
  current_streak: number;
  best_streak: number;
}

interface Message {
  id: string;
  created_at: string;
  original_content: string;
  input_type: string;
  cefr_estimate?: string;
  correction_type?: string;
}

interface Badge {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
}

interface UserBadge {
  badge_id: string;
  earned_at: string;
}

// ─── CEFR config ──────────────────────────────────────────────────────────────

const CEFR_LEVELS = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'] as const;
type CefrLevel = typeof CEFR_LEVELS[number];

const CEFR_XP_THRESHOLDS: Record<CefrLevel, { min: number; max: number }> = {
  A1: { min: 0,    max: 500   },
  A2: { min: 500,  max: 1500  },
  B1: { min: 1500, max: 3500  },
  B2: { min: 3500, max: 7000  },
  C1: { min: 7000, max: 12000 },
  C2: { min: 12000, max: 20000 },
};

function getCefrClass(level: string): string {
  return `cefr-${level.toLowerCase()}`;
}

function getXpProgress(level: string, totalXp: number): { current: number; needed: number; pct: number } {
  const threshold = CEFR_XP_THRESHOLDS[level as CefrLevel] ?? { min: 0, max: 1000 };
  const current = Math.max(0, totalXp - threshold.min);
  const needed = threshold.max - threshold.min;
  const pct = Math.min(100, Math.round((current / needed) * 100));
  return { current, needed, pct };
}

// ─── Mock heatmap data ─────────────────────────────────────────────────────────

function generateHeatmapData(): number[][] {
  // 7 rows (Mon-Sun) × 12 weeks
  const data: number[][] = [];
  for (let day = 0; day < 7; day++) {
    const row: number[] = [];
    for (let week = 0; week < 12; week++) {
      // Recent weeks more active
      const recencyBoost = week > 8 ? 1.5 : 1;
      const rand = Math.random() * recencyBoost;
      if (rand < 0.4) row.push(0);
      else if (rand < 0.8) row.push(1);
      else if (rand < 1.1) row.push(2);
      else row.push(3);
    }
    data.push(row);
  }
  return data;
}

function heatmapColor(level: number): string {
  switch (level) {
    case 0: return 'rgba(255,255,255,0.05)';
    case 1: return 'rgba(245,158,11,0.20)';
    case 2: return 'rgba(245,158,11,0.50)';
    case 3: return 'rgba(245,158,11,1.00)';
    default: return 'rgba(255,255,255,0.05)';
  }
}

const DAY_LABELS = ['Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa', 'So'];

function getMonthLabels(): string[] {
  const labels: string[] = [];
  const now = new Date();
  for (let w = 11; w >= 0; w--) {
    const d = new Date(now);
    d.setDate(d.getDate() - w * 7);
    labels.push(d.toLocaleDateString('de-DE', { month: 'short' }));
  }
  return labels;
}

// ─── Radar chart data ──────────────────────────────────────────────────────────

const RADAR_CATEGORIES = [
  { subject: 'Artikel',      A: 65 },
  { subject: 'Wortstellung', A: 48 },
  { subject: 'Konjugation',  A: 72 },
  { subject: 'Präposition',  A: 55 },
  { subject: 'Kasus',        A: 40 },
  { subject: 'Genus',        A: 60 },
];

// ─── Mock badges ──────────────────────────────────────────────────────────────

const MOCK_BADGES: Badge[] = [
  { id: '1', name: 'Erster Schritt',    description: 'Erste Korrektur erhalten',       icon: '⭐', color: '#F59E0B' },
  { id: '2', name: 'Wochenstrier',      description: '7-Tage-Streak erreicht',         icon: '🔥', color: '#EF4444' },
  { id: '3', name: 'Grammatik-Held',    description: '50 Korrekturen abgeschlossen',   icon: '🏆', color: '#10B981' },
  { id: '4', name: 'Polyglott',         description: 'B1-Niveau erreicht',             icon: '🌍', color: '#BAE6FD' },
  { id: '5', name: 'Nachtfalke',        description: 'Nach 22 Uhr geübt',              icon: '🦉', color: '#8B5CF6' },
  { id: '6', name: 'Perfektionist',     description: '100 Korrekturen ohne Pause',     icon: '💎', color: '#6EE7B7' },
];

// ─── Skeleton components ──────────────────────────────────────────────────────

function SkeletonCard({ h = 120 }: { h?: number }) {
  return (
    <div
      className="skeleton rounded-2xl"
      style={{ height: h, background: undefined }}
    />
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', gap: 12, padding: '12px 0', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
      <div className="skeleton" style={{ width: 80, height: 16, borderRadius: 6 }} />
      <div className="skeleton" style={{ flex: 1, height: 16, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 60, height: 16, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 40, height: 16, borderRadius: 6 }} />
    </div>
  );
}

// ─── Icon helpers ──────────────────────────────────────────────────────────────

function TypeIcon({ type }: { type: string }) {
  if (type === 'audio') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#8B5CF6' }}>
        <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
        <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
        <line x1="12" y1="19" x2="12" y2="23"/>
        <line x1="8" y1="23" x2="16" y2="23"/>
      </svg>
    );
  }
  if (type === 'image') {
    return (
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#BAE6FD' }}>
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"/>
        <circle cx="8.5" cy="8.5" r="1.5"/>
        <polyline points="21 15 16 10 5 21"/>
      </svg>
    );
  }
  return (
    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: '#F59E0B' }}>
      <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
      <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
    </svg>
  );
}

function LockIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="2">
      <rect x="3" y="11" width="18" height="11" rx="2" ry="2"/>
      <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
    </svg>
  );
}

// ─── Section heading ───────────────────────────────────────────────────────────

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase',
      color: 'var(--text-muted)',
      marginBottom: 16,
      fontWeight: 600,
    }}>
      {children}
    </h2>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ProgressPage() {
  const [loading, setLoading] = useState(true);
  const [xpData, setXpData] = useState<XpData>({ total_xp: 0, level: 'A1' });
  const [streakData, setStreakData] = useState<StreakData>({ current_streak: 0, best_streak: 0 });
  const [messages, setMessages] = useState<Message[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);
  const [userBadges, setUserBadges] = useState<UserBadge[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [hoveredBadge, setHoveredBadge] = useState<string | null>(null);

  const heatmapData = useMemo(() => generateHeatmapData(), []);
  const monthLabels = useMemo(() => getMonthLabels(), []);

  useEffect(() => {
    async function fetchData() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [xpRes, streakRes, messagesRes, badgesRes, userBadgesRes] = await Promise.all([
          supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single(),
          supabase.from('streaks').select('current_streak, best_streak').eq('user_id', user.id).single(),
          supabase.from('messages').select('id, created_at, original_content, input_type, cefr_estimate, correction_type').eq('user_id', user.id).order('created_at', { ascending: false }).limit(10),
          supabase.from('badges').select('id, name, description, icon, color'),
          supabase.from('user_badges').select('badge_id, earned_at').eq('user_id', user.id),
        ]);

        if (xpRes.data) setXpData(xpRes.data);
        if (streakRes.data) setStreakData(streakRes.data);
        if (messagesRes.data) setMessages(messagesRes.data);

        const fetchedBadges: Badge[] = (badgesRes.data ?? []).map((b: Record<string, unknown>) => ({
          id: String(b.id ?? ''),
          name: String(b.name ?? ''),
          description: String(b.description ?? ''),
          icon: String(b.icon ?? '⭐'),
          color: String(b.color ?? '#F59E0B'),
        }));
        setBadges(fetchedBadges.length > 0 ? fetchedBadges : MOCK_BADGES);

        const fetchedUserBadges: UserBadge[] = (userBadgesRes.data ?? []).map((ub: Record<string, unknown>) => ({
          badge_id: String(ub.badge_id ?? ''),
          earned_at: String(ub.earned_at ?? ''),
        }));
        setUserBadges(fetchedUserBadges);
      } catch {
        // Graceful fallback — keep defaults / mock data
        setBadges(MOCK_BADGES);
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const earnedBadgeIds = new Set(userBadges.map((ub) => ub.badge_id));

  const filteredMessages = messages.filter((m) =>
    m.original_content?.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const xpProgress = getXpProgress(xpData.level, xpData.total_xp);

  // ── Derived stats ────────────────────────────────────────────────────────────
  const totalCorrections = messages.length;
  const badgesEarned = earnedBadgeIds.size;

  // ── Render ───────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      padding: '32px 24px 64px',
      maxWidth: 1100,
      margin: '0 auto',
    }}>

      {/* ── 1. CEFR Hero ───────────────────────────────────────────────────── */}
      {loading ? (
        <SkeletonCard h={220} />
      ) : (
        <div
          className="glass-amber glow-amber animate-fade-up"
          style={{
            borderRadius: 24,
            padding: '48px 40px',
            textAlign: 'center',
            marginBottom: 32,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Decorative ambient glow */}
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'radial-gradient(ellipse 60% 50% at 50% 0%, rgba(245,158,11,0.12) 0%, transparent 70%)',
          }} />

          <p style={{
            fontFamily: 'var(--font-display)',
            fontSize: 11,
            letterSpacing: '0.15em',
            textTransform: 'uppercase',
            color: 'var(--text-muted)',
            marginBottom: 16,
          }}>
            Dein aktuelles Niveau
          </p>

          {/* CEFR badge */}
          <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 20 }}>
            <div
              className={`${getCefrClass(xpData.level)} glow-amber-strong animate-pulse-glow`}
              style={{
                width: 100,
                height: 100,
                borderRadius: 24,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontFamily: 'var(--font-display)',
                fontSize: 36,
                fontWeight: 800,
                color: '#fff',
                letterSpacing: '-0.02em',
              }}
            >
              {xpData.level}
            </div>
          </div>

          {/* Total XP */}
          <div style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 40,
            fontWeight: 700,
            color: 'var(--amber)',
            lineHeight: 1,
            marginBottom: 6,
            textShadow: '0 0 30px rgba(245,158,11,0.5)',
          }}>
            {xpData.total_xp.toLocaleString('de-DE')}
          </div>
          <p style={{ color: 'var(--text-muted)', fontSize: 13, marginBottom: 24 }}>
            XP gesamt
          </p>

          {/* XP progress bar */}
          <div style={{ maxWidth: 400, margin: '0 auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {xpData.level}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {xpProgress.current} / {xpProgress.needed} XP
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                {CEFR_LEVELS[Math.min(CEFR_LEVELS.indexOf(xpData.level as CefrLevel) + 1, CEFR_LEVELS.length - 1)]}
              </span>
            </div>
            <div style={{
              height: 8,
              background: 'rgba(255,255,255,0.08)',
              borderRadius: 999,
              overflow: 'hidden',
            }}>
              <div
                className="xp-bar-fill"
                style={{ width: `${xpProgress.pct}%`, height: '100%' }}
              />
            </div>
            <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 8, textAlign: 'center' }}>
              {xpProgress.pct}% zum nächsten Level
            </p>
          </div>
        </div>
      )}

      {/* ── 2. Stats grid ──────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeading>Statistiken</SectionHeading>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))',
          gap: 16,
        }}>
          {loading ? (
            [0, 1, 2, 3].map((i) => <SkeletonCard key={i} h={110} />)
          ) : (
            <>
              <StatCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--amber)" strokeWidth="2">
                    <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                    <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                  </svg>
                }
                value={totalCorrections}
                label="Korrekturen gesamt"
              />
              <StatCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2">
                    <path d="M12 2c0 0-6 4.5-6 10a6 6 0 0 0 12 0c0-5.5-6-10-6-10z"/>
                  </svg>
                }
                value={streakData.current_streak}
                label="Aktuelle Serie (Tage)"
                accent="#EF4444"
              />
              <StatCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--ice)" strokeWidth="2">
                    <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"/>
                  </svg>
                }
                value={streakData.best_streak}
                label="Beste Serie (Tage)"
                accent="var(--ice)"
              />
              <StatCard
                icon={
                  <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="var(--success)" strokeWidth="2">
                    <circle cx="12" cy="8" r="6"/>
                    <path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>
                  </svg>
                }
                value={badgesEarned}
                label="Badges erworben"
                accent="var(--success)"
              />
            </>
          )}
        </div>
      </section>

      {/* ── 3. Weekly activity heatmap ─────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeading>Aktivität (letzte 12 Wochen)</SectionHeading>
        <div
          className="glass-surface"
          style={{ borderRadius: 16, padding: '24px 20px', overflowX: 'auto' }}
        >
          {/* Month labels */}
          <div style={{ display: 'flex', marginLeft: 30, marginBottom: 6, gap: 4 }}>
            {monthLabels.map((label, i) => (
              <div key={i} style={{
                width: 28,
                fontSize: 10,
                color: 'var(--text-muted)',
                fontFamily: 'var(--font-mono)',
                textAlign: 'center',
                flexShrink: 0,
              }}>
                {label}
              </div>
            ))}
          </div>

          {/* Grid rows */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {heatmapData.map((row, dayIdx) => (
              <div key={dayIdx} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{
                  width: 26,
                  fontSize: 10,
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-mono)',
                  flexShrink: 0,
                  textAlign: 'right',
                }}>
                  {DAY_LABELS[dayIdx]}
                </span>
                {row.map((level, weekIdx) => (
                  <div
                    key={weekIdx}
                    title={`${level > 0 ? level * 10 : 0} XP`}
                    style={{
                      width: 28,
                      height: 14,
                      borderRadius: 3,
                      background: heatmapColor(level),
                      flexShrink: 0,
                      cursor: 'default',
                      transition: 'transform 0.1s ease',
                    }}
                  />
                ))}
              </div>
            ))}
          </div>

          {/* Legend */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 16, justifyContent: 'flex-end' }}>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>weniger</span>
            {[0, 1, 2, 3].map((l) => (
              <div key={l} style={{ width: 14, height: 14, borderRadius: 3, background: heatmapColor(l) }} />
            ))}
            <span style={{ fontSize: 10, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>mehr</span>
          </div>
        </div>
      </section>

      {/* ── 4. Radar chart + correction history ───────────────────────────── */}
      <div style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))',
        gap: 24,
        marginBottom: 40,
      }}>
        {/* Radar chart */}
        <section>
          <SectionHeading>Fehlerkategorien</SectionHeading>
          <div
            className="glass-surface"
            style={{ borderRadius: 16, padding: 24, height: 320 }}
          >
            {loading ? (
              <div className="skeleton" style={{ width: '100%', height: '100%', borderRadius: 12 }} />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={RADAR_CATEGORIES} outerRadius="70%">
                  <PolarGrid
                    stroke="rgba(255,255,255,0.08)"
                    gridType="polygon"
                  />
                  <PolarAngleAxis
                    dataKey="subject"
                    tick={{
                      fill: 'rgba(248,250,252,0.5)',
                      fontSize: 11,
                      fontFamily: 'var(--font-body)',
                    }}
                  />
                  <Radar
                    name="Fehler"
                    dataKey="A"
                    stroke="#BAE6FD"
                    fill="#F59E0B"
                    fillOpacity={0.25}
                    strokeWidth={2}
                  />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </div>
        </section>

        {/* Correction history */}
        <section>
          <SectionHeading>Korrekturverlauf</SectionHeading>
          <div
            className="glass-surface"
            style={{ borderRadius: 16, padding: 24, height: 320, display: 'flex', flexDirection: 'column' }}
          >
            {/* Search */}
            <input
              type="text"
              placeholder="Suchen…"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              style={{
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid var(--glass-border)',
                borderRadius: 8,
                padding: '8px 12px',
                fontSize: 13,
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
                marginBottom: 12,
                width: '100%',
                outline: 'none',
              }}
            />

            {/* Table header */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: '90px 1fr 40px 56px',
              gap: 8,
              padding: '0 0 8px',
              borderBottom: '1px solid rgba(255,255,255,0.08)',
              marginBottom: 4,
            }}>
              {['Datum', 'Original', 'Typ', 'CEFR'].map((h) => (
                <span key={h} style={{
                  fontSize: 10,
                  textTransform: 'uppercase',
                  letterSpacing: '0.08em',
                  color: 'var(--text-muted)',
                  fontFamily: 'var(--font-display)',
                }}>
                  {h}
                </span>
              ))}
            </div>

            {/* Rows */}
            <div style={{ flex: 1, overflowY: 'auto' }}>
              {loading ? (
                [0, 1, 2, 3, 4].map((i) => <SkeletonRow key={i} />)
              ) : filteredMessages.length === 0 ? (
                <p style={{ color: 'var(--text-muted)', fontSize: 13, textAlign: 'center', marginTop: 40 }}>
                  {searchQuery ? 'Keine Ergebnisse' : 'Noch keine Korrekturen'}
                </p>
              ) : (
                filteredMessages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: 'grid',
                      gridTemplateColumns: '90px 1fr 40px 56px',
                      gap: 8,
                      padding: '10px 0',
                      borderBottom: '1px solid rgba(255,255,255,0.05)',
                      alignItems: 'center',
                    }}
                  >
                    <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                      {new Date(msg.created_at).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' })}
                    </span>
                    <span style={{
                      fontSize: 12,
                      color: 'var(--text-primary)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {msg.original_content?.substring(0, 48) ?? '—'}
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      <TypeIcon type={msg.input_type ?? 'text'} />
                    </span>
                    <span style={{ display: 'flex', justifyContent: 'center' }}>
                      {msg.cefr_estimate ? (
                        <span
                          className={getCefrClass(msg.cefr_estimate)}
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 7px',
                            borderRadius: 999,
                            color: '#fff',
                            fontFamily: 'var(--font-mono)',
                          }}
                        >
                          {msg.cefr_estimate}
                        </span>
                      ) : (
                        <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>—</span>
                      )}
                    </span>
                  </div>
                ))
              )}
            </div>
          </div>
        </section>
      </div>

      {/* ── 5. Achievement badges grid ─────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeading>Errungenschaften</SectionHeading>
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))',
          gap: 16,
        }}>
          {loading ? (
            [0, 1, 2, 3, 4, 5].map((i) => <SkeletonCard key={i} h={140} />)
          ) : (
            (badges.length > 0 ? badges : MOCK_BADGES).map((badge) => {
              const isUnlocked = earnedBadgeIds.has(badge.id) || badges === MOCK_BADGES;
              const isHovered = hoveredBadge === badge.id;

              return (
                <div
                  key={badge.id}
                  onMouseEnter={() => setHoveredBadge(badge.id)}
                  onMouseLeave={() => setHoveredBadge(null)}
                  style={{
                    background: 'var(--bg-surface)',
                    border: isUnlocked
                      ? `1px solid ${badge.color}44`
                      : '1px solid var(--glass-border)',
                    borderRadius: 16,
                    padding: '24px 16px 20px',
                    textAlign: 'center',
                    position: 'relative',
                    overflow: 'hidden',
                    cursor: 'default',
                    transition: 'transform 0.2s ease, box-shadow 0.2s ease',
                    transform: isHovered ? 'translateY(-3px)' : 'none',
                    boxShadow: isHovered && isUnlocked
                      ? `0 8px 24px ${badge.color}33`
                      : 'none',
                    filter: isUnlocked ? 'none' : 'grayscale(1)',
                    opacity: isUnlocked ? 1 : 0.4,
                  }}
                >
                  {/* Ambient glow for unlocked */}
                  {isUnlocked && (
                    <div style={{
                      position: 'absolute',
                      top: 0, left: 0, right: 0,
                      height: 60,
                      background: `radial-gradient(ellipse at 50% 0%, ${badge.color}22 0%, transparent 70%)`,
                      pointerEvents: 'none',
                    }} />
                  )}

                  {/* Lock overlay for locked */}
                  {!isUnlocked && (
                    <div style={{
                      position: 'absolute',
                      top: 8, right: 8,
                    }}>
                      <LockIcon />
                    </div>
                  )}

                  {/* Icon */}
                  <div style={{ fontSize: 36, marginBottom: 10, lineHeight: 1 }}>
                    {badge.icon}
                  </div>

                  {/* Name */}
                  <div style={{
                    fontFamily: 'var(--font-display)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: 'var(--text-primary)',
                    marginBottom: 6,
                    lineHeight: 1.3,
                  }}>
                    {badge.name}
                  </div>

                  {/* Description — visible on hover */}
                  <div style={{
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    lineHeight: 1.4,
                    maxHeight: isHovered ? 60 : 0,
                    overflow: 'hidden',
                    transition: 'max-height 0.25s ease, opacity 0.25s ease',
                    opacity: isHovered ? 1 : 0,
                  }}>
                    {badge.description}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </section>
    </div>
  );
}

// ─── StatCard ─────────────────────────────────────────────────────────────────

function StatCard({
  icon,
  value,
  label,
  accent = 'var(--amber)',
}: {
  icon: React.ReactNode;
  value: number;
  label: string;
  accent?: string;
}) {
  return (
    <div
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--glass-border)',
        borderRadius: 16,
        padding: '24px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 16,
      }}
    >
      <div style={{
        width: 44,
        height: 44,
        borderRadius: 12,
        background: `${accent}18`,
        border: `1px solid ${accent}33`,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}>
        {icon}
      </div>
      <div>
        <div style={{
          fontFamily: 'var(--font-mono)',
          fontSize: 28,
          fontWeight: 700,
          color: accent,
          lineHeight: 1,
          marginBottom: 4,
        }}>
          {value}
        </div>
        <div style={{
          fontSize: 12,
          color: 'var(--text-muted)',
          fontFamily: 'var(--font-body)',
        }}>
          {label}
        </div>
      </div>
    </div>
  );
}
