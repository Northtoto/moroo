'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { createClient } from '@/lib/supabase/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Player {
  id: string;
  name: string;
  avatar: string | null;
  xp: number;
  level: string;
  streak: number;
  isCurrentUser?: boolean;
}

type LeagueTab = 'weekly' | 'alltime';

// ─── League tier config ───────────────────────────────────────────────────────

const LEAGUE_TIERS = [
  { name: 'Bronze',   minXp: 0,     color: '#CD7F32', glow: 'rgba(205,127,50,0.25)',  icon: '🥉' },
  { name: 'Silber',   minXp: 500,   color: '#C0C0C0', glow: 'rgba(192,192,192,0.25)', icon: '🥈' },
  { name: 'Gold',     minXp: 1500,  color: '#F59E0B', glow: 'rgba(245,158,11,0.30)',  icon: '🥇' },
  { name: 'Platin',   minXp: 3500,  color: '#BAE6FD', glow: 'rgba(186,230,253,0.30)', icon: '💎' },
  { name: 'Diamant',  minXp: 7000,  color: '#8B5CF6', glow: 'rgba(139,92,246,0.30)',  icon: '👑' },
];

function getTier(xp: number) {
  let tier = LEAGUE_TIERS[0];
  for (const t of LEAGUE_TIERS) {
    if (xp >= t.minXp) tier = t;
  }
  return tier;
}

function getNextTier(xp: number) {
  for (const t of LEAGUE_TIERS) {
    if (xp < t.minXp) return t;
  }
  return null;
}

// ─── CEFR helpers ─────────────────────────────────────────────────────────────

function getCefrClass(level: string) {
  return `cefr-${level.toLowerCase()}`;
}

// Fallback shown only when DB returns no other users (e.g. solo dev testing)
const FALLBACK_PLAYERS: Omit<Player, 'isCurrentUser'>[] = [
  { id: 'p1', name: 'Yasmin K.', avatar: null, xp: 4820, level: 'B2', streak: 21 },
  { id: 'p2', name: 'Lukas M.',  avatar: null, xp: 4250, level: 'B2', streak: 14 },
];

// ─── Rank medal helpers ───────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return <span style={{ fontSize: 22 }}>🥇</span>;
  if (rank === 2) return <span style={{ fontSize: 22 }}>🥈</span>;
  if (rank === 3) return <span style={{ fontSize: 22 }}>🥉</span>;
  return (
    <span style={{
      fontFamily: 'var(--font-mono)',
      fontSize: 13,
      fontWeight: 700,
      color: 'var(--text-muted)',
      width: 28,
      textAlign: 'center',
      display: 'inline-block',
    }}>
      {rank}
    </span>
  );
}

function Avatar({ name, avatarUrl, size = 36 }: { name: string; avatarUrl: string | null; size?: number }) {
  const initials = name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  return (
    <div style={{
      width: size,
      height: size,
      borderRadius: '50%',
      background: 'linear-gradient(135deg, var(--amber), #fbbf24)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontSize: size * 0.35,
      fontWeight: 700,
      color: '#0a0c12',
      fontFamily: 'var(--font-display)',
      flexShrink: 0,
      overflow: 'hidden',
    }}>
      {avatarUrl ? (
        <Image src={avatarUrl} alt={name} width={size} height={size} style={{ width: '100%', height: '100%', objectFit: 'cover' }} unoptimized />
      ) : (
        initials
      )}
    </div>
  );
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h2 style={{
      fontFamily: 'var(--font-display)',
      fontSize: 11,
      letterSpacing: '0.12em',
      textTransform: 'uppercase' as const,
      color: 'var(--text-muted)',
      marginBottom: 16,
      fontWeight: 600,
    }}>
      {children}
    </h2>
  );
}

function SkeletonRow() {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px' }}>
      <div className="skeleton" style={{ width: 28, height: 20, borderRadius: 4, flexShrink: 0 }} />
      <div className="skeleton" style={{ width: 36, height: 36, borderRadius: '50%', flexShrink: 0 }} />
      <div className="skeleton" style={{ flex: 1, height: 14, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 60, height: 14, borderRadius: 6 }} />
      <div className="skeleton" style={{ width: 36, height: 20, borderRadius: 999 }} />
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

interface WeeklyStats { text_corrections: number; audio_corrections: number; active_days: number; }

export default function LeaguePage() {
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<LeagueTab>('weekly');
  const [currentUser, setCurrentUser] = useState<Player | null>(null);
  const [dbPlayers, setDbPlayers] = useState<Omit<Player, 'isCurrentUser'>[]>([]);
  const [weeklyStats, setWeeklyStats] = useState<WeeklyStats>({ text_corrections: 0, audio_corrections: 0, active_days: 0 });

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        // Fetch current user data + leaderboard + weekly stats in parallel
        const [profileRes, xpRes, streakRes, leaderboardRes, weeklyRes] = await Promise.all([
          supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(),
          supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single(),
          supabase.from('streaks').select('current_streak').eq('user_id', user.id).single(),
          // get_leaderboard uses SECURITY DEFINER — returns all users ranked by XP
          supabase.rpc('get_leaderboard', { p_limit: 10 }),
          supabase.rpc('get_weekly_stats', { p_user_id: user.id }),
        ]);

        setCurrentUser({
          id: user.id,
          name: profileRes.data?.full_name ?? user.email?.split('@')[0] ?? 'Du',
          avatar: profileRes.data?.avatar_url ?? null,
          xp: xpRes.data?.total_xp ?? 0,
          level: xpRes.data?.level ?? 'A1',
          streak: streakRes.data?.current_streak ?? 0,
          isCurrentUser: true,
        });

        if (leaderboardRes.data && leaderboardRes.data.length > 0) {
          setDbPlayers(
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            (leaderboardRes.data as any[]).map((row) => ({
              id: row.user_id as string,
              name: (row.full_name as string) || 'Anonym',
              avatar: (row.avatar_url as string | null) ?? null,
              xp: (row.total_xp as number) ?? 0,
              level: (row.level as string) ?? 'A1',
              streak: (row.streak as number) ?? 0,
            }))
          );
        }

        if (weeklyRes.data) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const w = weeklyRes.data as any;
          setWeeklyStats({
            text_corrections: Number(w.text_corrections ?? 0),
            audio_corrections: Number(w.audio_corrections ?? 0),
            active_days: Number(w.active_days ?? 0),
          });
        }
      } catch {
        // Graceful fallback — no crash, no fake data for current user
        setCurrentUser({ id: 'me', name: 'Du', avatar: null, xp: 0, level: 'A1', streak: 0, isCurrentUser: true });
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // Use real DB players; fall back to placeholder only when no other users exist
  const baseList = dbPlayers.length > 0 ? dbPlayers : FALLBACK_PLAYERS;

  const leaderboard: Player[] = (() => {
    if (!currentUser) return baseList;
    const withoutMe = baseList.filter((p) => p.id !== currentUser.id);
    const meEntry: Player = { ...currentUser, isCurrentUser: true };
    const merged = [...withoutMe, meEntry].sort((a, b) => b.xp - a.xp);
    return merged;
  })();

  const myRank = leaderboard.findIndex((p) => p.isCurrentUser) + 1;
  const myXp = currentUser?.xp ?? 0;
  const tier = getTier(myXp);
  const nextTier = getNextTier(myXp);
  const tierProgress = nextTier
    ? Math.min(100, Math.round(((myXp - tier.minXp) / (nextTier.minXp - tier.minXp)) * 100))
    : 100;

  const PROMO_ZONE = 3;   // top 3 get promoted
  const SAFE_ZONE = 7;    // 4–7 are safe
  // bottom 3 (8–10) are demotion zone

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      padding: '32px 24px 80px',
      maxWidth: 800,
      margin: '0 auto',
    }}>

      {/* ── Page title ──────────────────────────────────────────────────────── */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          Liga
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Messe dich mit anderen Deutschlernenden — jede Woche neue Platzierungen.
        </p>
      </div>

      {/* ── League tier hero ────────────────────────────────────────────────── */}
      {loading ? (
        <div className="skeleton" style={{ height: 200, borderRadius: 24, marginBottom: 32 }} />
      ) : (
        <div
          className="animate-fade-up"
          style={{
            borderRadius: 24,
            padding: '40px 32px',
            marginBottom: 32,
            textAlign: 'center',
            background: `radial-gradient(ellipse 80% 60% at 50% 0%, ${tier.glow} 0%, var(--bg-surface) 70%)`,
            border: `1px solid ${tier.color}33`,
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          {/* Tier icon */}
          <div style={{ fontSize: 56, marginBottom: 8, lineHeight: 1 }}>{tier.icon}</div>

          <div style={{
            fontFamily: 'var(--font-display)',
            fontSize: 28,
            fontWeight: 800,
            color: tier.color,
            marginBottom: 4,
            textShadow: `0 0 24px ${tier.glow}`,
          }}>
            {tier.name}-Liga
          </div>

          <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 24 }}>
            Rang <strong style={{ color: 'var(--text-primary)' }}>#{myRank}</strong> von {leaderboard.length} Spielern
          </p>

          {/* Progress to next tier */}
          {nextTier && (
            <div style={{ maxWidth: 360, margin: '0 auto' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {tier.name}
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {myXp.toLocaleString('de-DE')} / {nextTier.minXp.toLocaleString('de-DE')} XP
                </span>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                  {nextTier.name}
                </span>
              </div>
              <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${tierProgress}%`,
                  background: `linear-gradient(90deg, ${tier.color}, ${nextTier.color})`,
                  borderRadius: 999,
                  transition: 'width 1s ease',
                }} />
              </div>
              <p style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 6 }}>
                Noch {(nextTier.minXp - myXp).toLocaleString('de-DE')} XP bis {nextTier.icon} {nextTier.name}
              </p>
            </div>
          )}

          {!nextTier && (
            <p style={{ fontSize: 13, color: tier.color, fontWeight: 700 }}>
              👑 Maximales Niveau erreicht!
            </p>
          )}
        </div>
      )}

      {/* ── Tab switcher ────────────────────────────────────────────────────── */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {(['weekly', 'alltime'] as LeagueTab[]).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            style={{
              padding: '8px 20px',
              borderRadius: 999,
              fontSize: 13,
              fontWeight: 600,
              fontFamily: 'var(--font-display)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              background: tab === t ? 'var(--amber)' : 'rgba(255,255,255,0.05)',
              color: tab === t ? '#0a0c12' : 'var(--text-muted)',
              border: tab === t ? 'none' : '1px solid var(--glass-border)',
            }}
          >
            {t === 'weekly' ? '⚡ Diese Woche' : '🏆 Alle Zeiten'}
          </button>
        ))}
      </div>

      {/* ── Leaderboard ─────────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 40 }}>
        <SectionHeading>Rangliste</SectionHeading>

        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--glass-border)',
          borderRadius: 20,
          overflow: 'hidden',
        }}>
          {loading ? (
            [0,1,2,3,4,5,6,7,8,9].map((i) => <SkeletonRow key={i} />)
          ) : (
            leaderboard.map((player, idx) => {
              const rank = idx + 1;
              const isPromo = rank <= PROMO_ZONE;
              const isDemotion = rank > SAFE_ZONE;
              const isMe = player.isCurrentUser;

              return (
                <div
                  key={player.id}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 12,
                    padding: '12px 16px',
                    borderBottom: idx < leaderboard.length - 1
                      ? '1px solid rgba(255,255,255,0.05)'
                      : 'none',
                    background: isMe
                      ? 'rgba(245,158,11,0.07)'
                      : 'transparent',
                    borderLeft: isMe
                      ? '3px solid var(--amber)'
                      : '3px solid transparent',
                    transition: 'background 0.15s ease',
                  }}
                >
                  {/* Rank */}
                  <div style={{ width: 32, display: 'flex', justifyContent: 'center', flexShrink: 0 }}>
                    <RankBadge rank={rank} />
                  </div>

                  {/* Avatar */}
                  <Avatar name={player.name} avatarUrl={player.avatar} />

                  {/* Name + streak */}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{
                        fontSize: 14,
                        fontWeight: isMe ? 700 : 500,
                        color: isMe ? 'var(--amber)' : 'var(--text-primary)',
                        fontFamily: 'var(--font-display)',
                        whiteSpace: 'nowrap' as const,
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}>
                        {player.name}
                        {isMe && (
                          <span style={{
                            marginLeft: 6,
                            fontSize: 10,
                            background: 'var(--amber)',
                            color: '#0a0c12',
                            borderRadius: 4,
                            padding: '1px 5px',
                            fontWeight: 700,
                          }}>
                            Du
                          </span>
                        )}
                      </span>
                    </div>
                    {player.streak > 0 && (
                      <span style={{ fontSize: 11, color: 'var(--text-muted)' }}>
                        🔥 {player.streak} {player.streak === 1 ? 'Tag' : 'Tage'} Serie
                      </span>
                    )}
                  </div>

                  {/* XP */}
                  <div style={{
                    fontFamily: 'var(--font-mono)',
                    fontSize: 13,
                    fontWeight: 700,
                    color: isMe ? 'var(--amber)' : 'var(--text-muted)',
                    textAlign: 'right' as const,
                    flexShrink: 0,
                    minWidth: 72,
                  }}>
                    {player.xp.toLocaleString('de-DE')}
                    <span style={{ fontSize: 10, fontWeight: 400, marginLeft: 3 }}>XP</span>
                  </div>

                  {/* CEFR badge */}
                  <div style={{ flexShrink: 0 }}>
                    <span
                      className={getCefrClass(player.level)}
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '3px 8px',
                        borderRadius: 999,
                        color: '#fff',
                        fontFamily: 'var(--font-mono)',
                        display: 'inline-block',
                      }}
                    >
                      {player.level}
                    </span>
                  </div>

                  {/* Zone indicator */}
                  <div style={{ flexShrink: 0, width: 20 }}>
                    {isPromo && (
                      <span title="Aufstiegszone" style={{ fontSize: 14 }}>🔼</span>
                    )}
                    {isDemotion && (
                      <span title="Abstiegszone" style={{ fontSize: 14 }}>🔽</span>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Zone legend */}
        <div style={{
          display: 'flex',
          gap: 16,
          marginTop: 12,
          flexWrap: 'wrap' as const,
        }}>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🔼 <span>Aufstiegszone (Top 3)</span>
          </span>
          <span style={{ fontSize: 11, color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: 4 }}>
            🔽 <span>Abstiegszone (Plätze 8–10)</span>
          </span>
        </div>
      </section>

      {/* ── Weekly challenge card ────────────────────────────────────────────── */}
      <section>
        <SectionHeading>Wochenaufgabe</SectionHeading>
        <div style={{
          background: 'var(--bg-surface)',
          border: '1px solid rgba(245,158,11,0.20)',
          borderRadius: 20,
          padding: '24px',
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: 20,
        }}>
          {[
            { label: 'Korrekturen diese Woche', target: 30, current: weeklyStats.text_corrections,  icon: '✏️', color: 'var(--amber)' },
            { label: 'Tage aktiv diese Woche',  target: 7,  current: weeklyStats.active_days,       icon: '📅', color: 'var(--success)' },
            { label: 'Audio-Korrekturen',        target: 5,  current: weeklyStats.audio_corrections, icon: '🎤', color: '#8B5CF6' },
          ].map((challenge) => {
            const pct = Math.min(100, Math.round((challenge.current / challenge.target) * 100));
            return (
              <div key={challenge.label}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
                  <span style={{ fontSize: 20 }}>{challenge.icon}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {challenge.label}
                  </span>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                  <span style={{ fontSize: 12, color: 'var(--text-muted)', fontFamily: 'var(--font-mono)' }}>
                    {challenge.current} / {challenge.target}
                  </span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: challenge.color, fontFamily: 'var(--font-mono)' }}>
                    {pct}%
                  </span>
                </div>
                <div style={{ height: 6, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${pct}%`,
                    background: challenge.color,
                    borderRadius: 999,
                    transition: 'width 0.8s ease',
                  }} />
                </div>
              </div>
            );
          })}
        </div>
      </section>

    </div>
  );
}
