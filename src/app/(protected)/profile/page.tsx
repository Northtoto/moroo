'use client';

import { useEffect, useState, useRef } from 'react';
import { createClient } from '@/lib/supabase/client';
import toast from 'react-hot-toast';

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileData {
  id: string;
  full_name: string | null;
  avatar_url: string | null;
  email: string;
  subscription_tier: 'free' | 'premium';
  approval_status: 'pending' | 'approved' | 'rejected';
  is_admin: boolean;
  created_at: string;
}

interface StatsData {
  total_xp: number;
  level: string;
  current_streak: number;
  best_streak: number;
  total_corrections: number;
}

// ─── CEFR helpers ─────────────────────────────────────────────────────────────

const CEFR_LABELS: Record<string, string> = {
  A1: 'Einsteiger', A2: 'Grundlagen',
  B1: 'Fortgeschritten', B2: 'Selbstständig',
  C1: 'Kompetent', C2: 'Meister',
};

function getCefrClass(level: string) {
  return `cefr-${level.toLowerCase()}`;
}

// ─── Sub-components ───────────────────────────────────────────────────────────

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

function Card({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <div style={{
      background: 'var(--bg-surface)',
      border: '1px solid var(--glass-border)',
      borderRadius: 20,
      padding: '24px',
      ...style,
    }}>
      {children}
    </div>
  );
}

function SkeletonCard({ h = 120 }: { h?: number }) {
  return <div className="skeleton" style={{ height: h, borderRadius: 20 }} />;
}

function StatPill({
  icon, value, label, color = 'var(--amber)',
}: { icon: string; value: string | number; label: string; color?: string }) {
  return (
    <div style={{
      background: 'var(--glass-bg)',
      border: '1px solid var(--glass-border)',
      borderRadius: 14,
      padding: '16px 20px',
      textAlign: 'center' as const,
    }}>
      <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
      <div style={{
        fontFamily: 'var(--font-mono)',
        fontSize: 22,
        fontWeight: 700,
        color,
        lineHeight: 1,
        marginBottom: 4,
      }}>
        {value}
      </div>
      <div style={{ fontSize: 11, color: 'var(--text-muted)' }}>{label}</div>
    </div>
  );
}

// ─── Main page ─────────────────────────────────────────────────────────────────

// ─── Export button states ────────────────────────────────────────────────────

interface ExportButton {
  icon: string;
  label: string;
  sublabel: string;
  action: 'sheets' | 'drive' | 'calendar';
  disabled?: boolean;
}

const EXPORT_BUTTONS: ExportButton[] = [
  {
    icon: '📊',
    label: 'Als Google Sheet exportieren',
    sublabel: 'Alle Korrekturen in ein neues Google Sheet',
    action: 'sheets',
  },
  {
    icon: '📁',
    label: 'Drive-Backup herunterladen',
    sublabel: 'JSON-Backup dieses Monats in Google Drive',
    action: 'drive',
  },
  {
    icon: '📅',
    label: 'Lernplan in Calendar eintragen',
    sublabel: 'Demnächst verfügbar',
    action: 'calendar',
    disabled: true,
  },
];

export default function ProfilePage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [changingPw, setChangingPw] = useState(false);
  const [profile, setProfile] = useState<ProfileData | null>(null);
  const [exportLoading, setExportLoading] = useState<Record<string, boolean>>({});
  const [stats, setStats] = useState<StatsData>({
    total_xp: 0, level: 'A1',
    current_streak: 0, best_streak: 0, total_corrections: 0,
  });

  // Edit state
  const [editName, setEditName] = useState('');
  const [nameChanged, setNameChanged] = useState(false);

  // Password change
  const [showPwForm, setShowPwForm] = useState(false);
  const [_pwCurrent, setPwCurrent] = useState('');
  const [pwNew, setPwNew] = useState('');
  const [pwConfirm, setPwConfirm] = useState('');

  // Avatar upload
  const fileRef = useRef<HTMLInputElement>(null);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);

  // ── Load data ──────────────────────────────────────────────────────────────

  useEffect(() => {
    async function load() {
      try {
        const supabase = createClient();
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) return;

        const [profileRes, xpRes, streakRes, msgRes] = await Promise.all([
          supabase.from('profiles').select('*').eq('id', user.id).single(),
          supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single(),
          supabase.from('streaks').select('current_streak, best_streak').eq('user_id', user.id).single(),
          supabase.from('messages').select('id', { count: 'exact', head: true }).eq('user_id', user.id),
        ]);

        const p: ProfileData = {
          id: user.id,
          full_name: profileRes.data?.full_name ?? null,
          avatar_url: profileRes.data?.avatar_url ?? null,
          email: user.email ?? '',
          subscription_tier: profileRes.data?.subscription_tier ?? 'free',
          approval_status: profileRes.data?.approval_status ?? 'approved',
          is_admin: profileRes.data?.is_admin ?? false,
          created_at: profileRes.data?.created_at ?? user.created_at,
        };

        setProfile(p);
        setEditName(p.full_name ?? '');

        setStats({
          total_xp: xpRes.data?.total_xp ?? 0,
          level: xpRes.data?.level ?? 'A1',
          current_streak: streakRes.data?.current_streak ?? 0,
          best_streak: streakRes.data?.best_streak ?? 0,
          total_corrections: msgRes.count ?? 0,
        });
      } catch {
        // graceful — keep defaults
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Save display name ──────────────────────────────────────────────────────

  async function saveName() {
    if (!profile || !nameChanged) return;
    setSaving(true);
    try {
      const supabase = createClient();
      const { error } = await supabase
        .from('profiles')
        .update({ full_name: editName.trim() || null })
        .eq('id', profile.id);

      if (error) throw error;
      setProfile((p) => p ? { ...p, full_name: editName.trim() || null } : p);
      setNameChanged(false);
      toast.success('Name gespeichert');
    } catch {
      toast.error('Speichern fehlgeschlagen');
    } finally {
      setSaving(false);
    }
  }

  // ── Change password ────────────────────────────────────────────────────────

  async function changePassword(e: React.FormEvent) {
    e.preventDefault();
    if (pwNew !== pwConfirm) { toast.error('Passwörter stimmen nicht überein'); return; }
    if (pwNew.length < 12) { toast.error('Passwort muss mindestens 12 Zeichen haben'); return; }
    setChangingPw(true);
    try {
      const supabase = createClient();
      const { error } = await supabase.auth.updateUser({ password: pwNew });
      if (error) throw error;
      toast.success('Passwort geändert');
      setShowPwForm(false);
      setPwCurrent(''); setPwNew(''); setPwConfirm('');
    } catch (err: unknown) {
      toast.error(err instanceof Error ? err.message : 'Fehler beim Ändern');
    } finally {
      setChangingPw(false);
    }
  }

  // ── Avatar upload ──────────────────────────────────────────────────────────

  async function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !profile) return;
    if (!file.type.startsWith('image/')) { toast.error('Bitte ein Bild hochladen'); return; }
    if (file.size > 2 * 1024 * 1024) { toast.error('Bild muss kleiner als 2 MB sein'); return; }

    setUploadingAvatar(true);
    try {
      const supabase = createClient();
      const ext = file.name.split('.').pop();
      const path = `avatars/${profile.id}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, file, { upsert: true });

      if (uploadError) throw uploadError;

      const { data: urlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const avatarUrl = urlData.publicUrl;

      await supabase.from('profiles').update({ avatar_url: avatarUrl }).eq('id', profile.id);
      setProfile((p) => p ? { ...p, avatar_url: avatarUrl } : p);
      toast.success('Avatar aktualisiert');
    } catch {
      toast.error('Upload fehlgeschlagen');
    } finally {
      setUploadingAvatar(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  // ── Derived ────────────────────────────────────────────────────────────────

  const initials = (profile?.full_name ?? profile?.email ?? 'U')
    .split(' ').map((w) => w[0]).join('').toUpperCase().slice(0, 2);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('de-DE', { year: 'numeric', month: 'long' })
    : '—';

  const pwStrength = (() => {
    if (pwNew.length === 0) return null;
    let score = 0;
    if (pwNew.length >= 12) score++;
    if (/[a-z]/.test(pwNew)) score++;
    if (/[A-Z]/.test(pwNew)) score++;
    if (/[0-9]/.test(pwNew)) score++;
    if (/[^a-zA-Z0-9]/.test(pwNew)) score++;
    if (score <= 2) return { label: 'Schwach', color: 'var(--danger)', pct: 33 };
    if (score <= 3) return { label: 'Mittel', color: 'var(--amber)', pct: 60 };
    return { label: 'Stark', color: 'var(--success)', pct: 100 };
  })();

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{
      minHeight: '100vh',
      background: 'var(--bg-base)',
      padding: '32px 24px 80px',
      maxWidth: 760,
      margin: '0 auto',
    }}>

      {/* Page title */}
      <div style={{ marginBottom: 32 }}>
        <h1 style={{
          fontFamily: 'var(--font-display)',
          fontSize: 24,
          fontWeight: 800,
          color: 'var(--text-primary)',
          marginBottom: 4,
        }}>
          Mein Profil
        </h1>
        <p style={{ fontSize: 13, color: 'var(--text-muted)' }}>
          Verwalte dein Konto und verfolge deinen Fortschritt.
        </p>
      </div>

      {/* ── 1. Hero card ─────────────────────────────────────────────────── */}
      {loading ? <SkeletonCard h={200} /> : (
        <div
          className="glass-amber animate-fade-up"
          style={{
            borderRadius: 24,
            padding: '32px',
            marginBottom: 28,
            display: 'flex',
            alignItems: 'center',
            gap: 24,
            flexWrap: 'wrap' as const,
          }}
        >
          {/* Avatar */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
            <div
              onClick={() => fileRef.current?.click()}
              title="Avatar ändern"
              style={{
                width: 80,
                height: 80,
                borderRadius: '50%',
                background: 'linear-gradient(135deg, var(--amber), #fbbf24)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 28,
                fontWeight: 700,
                color: '#0a0c12',
                fontFamily: 'var(--font-display)',
                cursor: 'pointer',
                overflow: 'hidden',
                border: '3px solid rgba(245,158,11,0.40)',
                transition: 'opacity 0.2s',
                opacity: uploadingAvatar ? 0.5 : 1,
              }}
            >
              {profile?.avatar_url ? (
                <img
                  src={profile.avatar_url}
                  alt={profile.full_name ?? 'Avatar'}
                  style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                />
              ) : initials}
            </div>
            {/* Camera icon overlay */}
            <div
              onClick={() => fileRef.current?.click()}
              style={{
                position: 'absolute',
                bottom: 0,
                right: 0,
                width: 24,
                height: 24,
                borderRadius: '50%',
                background: 'var(--amber)',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                cursor: 'pointer',
                border: '2px solid var(--bg-surface)',
              }}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#0a0c12" strokeWidth="2.5">
                <path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/>
                <circle cx="12" cy="13" r="4"/>
              </svg>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              style={{ display: 'none' }}
            />
          </div>

          {/* Info */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4, flexWrap: 'wrap' as const }}>
              <span style={{
                fontFamily: 'var(--font-display)',
                fontSize: 22,
                fontWeight: 800,
                color: 'var(--text-primary)',
              }}>
                {profile?.full_name ?? profile?.email?.split('@')[0] ?? 'Lernender'}
              </span>
              {profile?.is_admin && (
                <span style={{
                  fontSize: 10,
                  fontWeight: 700,
                  background: 'var(--amber)',
                  color: '#0a0c12',
                  borderRadius: 4,
                  padding: '2px 7px',
                  fontFamily: 'var(--font-display)',
                }}>
                  ADMIN
                </span>
              )}
              <span style={{
                fontSize: 10,
                fontWeight: 700,
                background: profile?.subscription_tier === 'premium'
                  ? 'linear-gradient(90deg, #8B5CF6, #BAE6FD)'
                  : 'rgba(255,255,255,0.08)',
                color: profile?.subscription_tier === 'premium' ? '#fff' : 'var(--text-muted)',
                borderRadius: 4,
                padding: '2px 7px',
                fontFamily: 'var(--font-display)',
              }}>
                {profile?.subscription_tier === 'premium' ? '✨ Premium' : 'Free'}
              </span>
            </div>
            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginBottom: 12 }}>
              {profile?.email}
            </p>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' as const }}>
              <span
                className={getCefrClass(stats.level)}
                style={{
                  fontSize: 11,
                  fontWeight: 700,
                  padding: '3px 10px',
                  borderRadius: 999,
                  color: '#fff',
                  fontFamily: 'var(--font-mono)',
                }}
              >
                {stats.level}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                {CEFR_LABELS[stats.level] ?? ''}
              </span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>·</span>
              <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Mitglied seit {memberSince}
              </span>
            </div>
          </div>

          {/* XP badge */}
          <div style={{
            textAlign: 'center' as const,
            flexShrink: 0,
          }}>
            <div style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 32,
              fontWeight: 800,
              color: 'var(--amber)',
              lineHeight: 1,
              textShadow: '0 0 24px rgba(245,158,11,0.5)',
            }}>
              {stats.total_xp.toLocaleString('de-DE')}
            </div>
            <div style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 4 }}>XP gesamt</div>
          </div>
        </div>
      )}

      {/* ── 2. Stats row ──────────────────────────────────────────────────── */}
      {loading ? <SkeletonCard h={110} /> : (
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))',
          gap: 12,
          marginBottom: 28,
        }}>
          <StatPill icon="🔥" value={stats.current_streak} label="Aktuelle Serie" color="#EF4444" />
          <StatPill icon="⭐" value={stats.best_streak} label="Beste Serie" color="var(--ice)" />
          <StatPill icon="✏️" value={stats.total_corrections} label="Korrekturen" color="var(--amber)" />
          <StatPill icon="📅" value={memberSince.split(' ').pop() ?? '—'} label="Dabei seit" color="var(--success)" />
        </div>
      )}

      {/* ── 3. Edit display name ───────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>Anzeigename</SectionHeading>
        {loading ? <SkeletonCard h={80} /> : (
          <Card>
            <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' as const }}>
              <div style={{ flex: 1, minWidth: 200 }}>
                <label style={{
                  display: 'block',
                  fontSize: 11,
                  color: 'var(--text-muted)',
                  marginBottom: 6,
                  fontFamily: 'var(--font-display)',
                  letterSpacing: '0.05em',
                }}>
                  Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) => { setEditName(e.target.value); setNameChanged(true); }}
                  maxLength={60}
                  placeholder="Dein Name"
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid var(--glass-border)',
                    borderRadius: 10,
                    padding: '10px 14px',
                    fontSize: 14,
                    color: 'var(--text-primary)',
                    fontFamily: 'var(--font-body)',
                    outline: 'none',
                    boxSizing: 'border-box' as const,
                  }}
                />
              </div>
              <button
                onClick={saveName}
                disabled={!nameChanged || saving}
                style={{
                  padding: '10px 22px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  fontFamily: 'var(--font-display)',
                  cursor: !nameChanged || saving ? 'not-allowed' : 'pointer',
                  background: !nameChanged || saving ? 'rgba(245,158,11,0.25)' : 'var(--amber)',
                  color: !nameChanged || saving ? 'rgba(245,158,11,0.5)' : '#0a0c12',
                  border: 'none',
                  transition: 'all 0.2s',
                  whiteSpace: 'nowrap' as const,
                }}
              >
                {saving ? 'Speichert…' : 'Speichern'}
              </button>
            </div>
          </Card>
        )}
      </section>

      {/* ── 4. Account info ────────────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>Kontoinfo</SectionHeading>
        {loading ? <SkeletonCard h={130} /> : (
          <Card>
            <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 0 }}>
              {[
                { label: 'E-Mail', value: profile?.email ?? '—' },
                { label: 'Mitglied seit', value: memberSince },
                {
                  label: 'Status',
                  value: profile?.approval_status === 'approved' ? '✅ Freigegeben'
                    : profile?.approval_status === 'pending' ? '⏳ Ausstehend'
                    : '❌ Abgelehnt',
                },
                {
                  label: 'Plan',
                  value: profile?.subscription_tier === 'premium' ? '✨ Premium' : '🆓 Free',
                },
              ].map((row, i, arr) => (
                <div
                  key={row.label}
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    padding: '12px 0',
                    borderBottom: i < arr.length - 1 ? '1px solid rgba(255,255,255,0.06)' : 'none',
                  }}
                >
                  <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>{row.label}</span>
                  <span style={{ fontSize: 13, color: 'var(--text-primary)', fontWeight: 500 }}>
                    {row.value}
                  </span>
                </div>
              ))}
            </div>
          </Card>
        )}
      </section>

      {/* ── 5. Password change ──────────────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>Sicherheit</SectionHeading>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: showPwForm ? 20 : 0 }}>
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>
                Passwort ändern
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Mindestens 12 Zeichen mit Groß-/Kleinbuchstaben, Zahl und Sonderzeichen
              </p>
            </div>
            <button
              onClick={() => setShowPwForm((v) => !v)}
              style={{
                padding: '8px 16px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 600,
                cursor: 'pointer',
                background: showPwForm ? 'rgba(255,255,255,0.06)' : 'rgba(245,158,11,0.15)',
                color: showPwForm ? 'var(--text-muted)' : 'var(--amber)',
                border: '1px solid ' + (showPwForm ? 'var(--glass-border)' : 'rgba(245,158,11,0.3)'),
                fontFamily: 'var(--font-display)',
                flexShrink: 0,
                marginLeft: 16,
              }}
            >
              {showPwForm ? 'Abbrechen' : 'Ändern'}
            </button>
          </div>

          {showPwForm && (
            <form onSubmit={changePassword} style={{ display: 'flex', flexDirection: 'column' as const, gap: 12 }}>
              {[
                { id: 'pw-new', label: 'Neues Passwort', value: pwNew, setter: setPwNew },
                { id: 'pw-confirm', label: 'Passwort bestätigen', value: pwConfirm, setter: setPwConfirm },
              ].map(({ id, label, value, setter }) => (
                <div key={id}>
                  <label htmlFor={id} style={{
                    display: 'block',
                    fontSize: 11,
                    color: 'var(--text-muted)',
                    marginBottom: 5,
                    fontFamily: 'var(--font-display)',
                  }}>
                    {label}
                  </label>
                  <input
                    id={id}
                    type="password"
                    value={value}
                    onChange={(e) => setter(e.target.value)}
                    autoComplete="new-password"
                    style={{
                      width: '100%',
                      background: 'rgba(255,255,255,0.04)',
                      border: '1px solid var(--glass-border)',
                      borderRadius: 10,
                      padding: '10px 14px',
                      fontSize: 14,
                      color: 'var(--text-primary)',
                      fontFamily: 'var(--font-body)',
                      outline: 'none',
                      boxSizing: 'border-box' as const,
                    }}
                  />
                </div>
              ))}

              {/* Strength bar */}
              {pwStrength && (
                <div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 999, overflow: 'hidden', marginBottom: 4 }}>
                    <div style={{
                      height: '100%',
                      width: `${pwStrength.pct}%`,
                      background: pwStrength.color,
                      borderRadius: 999,
                      transition: 'width 0.3s ease',
                    }} />
                  </div>
                  <span style={{ fontSize: 11, color: pwStrength.color }}>{pwStrength.label}</span>
                </div>
              )}

              {/* Mismatch warning */}
              {pwConfirm && pwNew !== pwConfirm && (
                <p style={{ fontSize: 12, color: 'var(--danger)', margin: 0 }}>
                  ⚠ Passwörter stimmen nicht überein
                </p>
              )}

              <button
                type="submit"
                disabled={changingPw || !pwNew || pwNew !== pwConfirm}
                style={{
                  padding: '11px',
                  borderRadius: 10,
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: changingPw || !pwNew || pwNew !== pwConfirm ? 'not-allowed' : 'pointer',
                  background: changingPw || !pwNew || pwNew !== pwConfirm
                    ? 'rgba(245,158,11,0.25)' : 'var(--amber)',
                  color: changingPw || !pwNew || pwNew !== pwConfirm
                    ? 'rgba(245,158,11,0.4)' : '#0a0c12',
                  border: 'none',
                  fontFamily: 'var(--font-display)',
                  transition: 'all 0.2s',
                }}
              >
                {changingPw ? 'Ändert…' : 'Passwort speichern'}
              </button>
            </form>
          )}
        </Card>
      </section>

      {/* ── 6. Export & Integrations ──────────────────────────────────────── */}
      <section style={{ marginBottom: 28 }}>
        <SectionHeading>Export &amp; Integrationen</SectionHeading>
        <div style={{ display: 'flex', flexDirection: 'column' as const, gap: 10 }}>
          {EXPORT_BUTTONS.map((btn) => (
            <button
              key={btn.action}
              disabled={btn.disabled || exportLoading[btn.action]}
              onClick={async () => {
                if (btn.disabled) return;
                setExportLoading((prev) => ({ ...prev, [btn.action]: true }));
                try {
                  const res = await fetch(`/api/export/${btn.action}`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                  });
                  const data = await res.json();
                  if (!res.ok) throw new Error(data.error ?? 'Fehler');

                  if (btn.action === 'sheets' && data.spreadsheetUrl) {
                    window.open(data.spreadsheetUrl, '_blank');
                    toast.success(`Tabelle erstellt! ${data.rowCount} Zeilen exportiert ✓`);
                  } else if (btn.action === 'drive' && data.webViewLink) {
                    window.open(data.webViewLink, '_blank');
                    toast.success(`Drive-Backup erstellt! ${data.recordCount} Einträge ✓`);
                  }
                } catch (err: unknown) {
                  toast.error(err instanceof Error ? err.message : 'Export fehlgeschlagen');
                } finally {
                  setExportLoading((prev) => ({ ...prev, [btn.action]: false }));
                }
              }}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 16,
                padding: '16px 20px',
                background: btn.disabled
                  ? 'rgba(255,255,255,0.02)'
                  : exportLoading[btn.action]
                  ? 'rgba(245,158,11,0.08)'
                  : 'var(--bg-surface)',
                border: '1px solid ' + (btn.disabled ? 'rgba(255,255,255,0.04)' : 'var(--glass-border)'),
                borderRadius: 14,
                cursor: btn.disabled ? 'not-allowed' : exportLoading[btn.action] ? 'wait' : 'pointer',
                textAlign: 'left' as const,
                width: '100%',
                transition: 'all 0.2s',
                opacity: btn.disabled ? 0.4 : 1,
              }}
            >
              <span style={{ fontSize: 24, flexShrink: 0 }}>
                {exportLoading[btn.action] ? '⏳' : btn.icon}
              </span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{
                  fontSize: 14,
                  fontWeight: 600,
                  color: btn.disabled ? 'var(--text-muted)' : 'var(--text-primary)',
                  marginBottom: 2,
                }}>
                  {exportLoading[btn.action] ? 'Lädt…' : btn.label}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                  {btn.sublabel}
                </div>
              </div>
              {!btn.disabled && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none"
                  stroke="var(--text-muted)" strokeWidth="2">
                  <path d="M9 18l6-6-6-6"/>
                </svg>
              )}
            </button>
          ))}
        </div>
      </section>

      {/* ── 7. Sign out ─────────────────────────────────────────────────────── */}
      <section>
        <SectionHeading>Konto</SectionHeading>
        <Card>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ fontSize: 14, color: 'var(--text-primary)', fontWeight: 600, marginBottom: 2 }}>
                Abmelden
              </p>
              <p style={{ fontSize: 12, color: 'var(--text-muted)' }}>
                Auf allen Geräten abmelden
              </p>
            </div>
            <form action="/auth/signout" method="post">
              <button
                type="submit"
                style={{
                  padding: '8px 18px',
                  borderRadius: 8,
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                  background: 'rgba(239,68,68,0.12)',
                  color: 'var(--danger)',
                  border: '1px solid rgba(239,68,68,0.25)',
                  fontFamily: 'var(--font-display)',
                }}
              >
                Abmelden
              </button>
            </form>
          </div>
        </Card>
      </section>
    </div>
  );
}
