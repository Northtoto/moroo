'use client';

import { useState, useEffect, Suspense } from 'react';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';
import { useRouter, useSearchParams } from 'next/navigation';

// Isolated component for searchParams (required by Next.js for Suspense)
function LoginErrorFromParams({ onError }: { onError: (msg: string) => void }) {
  const searchParams = useSearchParams();
  useEffect(() => {
    if (searchParams.get('error') === 'account_locked') {
      onError('Dein Konto wurde vorübergehend gesperrt. Bitte versuche es später erneut.');
    }
  }, [searchParams, onError]);
  return null;
}

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const [attempts, setAttempts] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  const MAX_CLIENT_ATTEMPTS = 5;
  const LOCKOUT_MS = 15 * 60 * 1000;
  const isLocked = lockedUntil !== null && Date.now() < lockedUntil;

  useEffect(() => {
    if (!lockedUntil) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((lockedUntil - Date.now()) / 1000));
      setCountdown(remaining);
      if (remaining <= 0) { setLockedUntil(null); setAttempts(0); setError(''); }
    }, 1000);
    return () => clearInterval(interval);
  }, [lockedUntil]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    if (isLocked) { setError(`Gesperrt. Noch ${countdown} Sekunden warten.`); return; }
    if (!email.trim() || !password) { setError('Bitte E-Mail und Passwort eingeben.'); return; }

    setLoading(true);
    setError('');

    const { error: authError } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    });

    if (authError) {
      const next = attempts + 1;
      setAttempts(next);
      if (next >= MAX_CLIENT_ATTEMPTS) {
        setLockedUntil(Date.now() + LOCKOUT_MS);
        setError('Zu viele Versuche. Konto für 15 Minuten gesperrt.');
      } else {
        setError('Ungültige E-Mail oder Passwort.');
      }
      setLoading(false);
    } else {
      setAttempts(0);
      setLockedUntil(null);
      router.push('/tutor');
      router.refresh();
    }
  }

  return (
    <>
      <Suspense fallback={null}>
        <LoginErrorFromParams onError={setError} />
      </Suspense>

      <div
        className="rounded-2xl p-8 animate-fade-up"
        style={{
          background: 'var(--bg-surface)',
          border: '1px solid var(--glass-border)',
          boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
        }}
      >
        {/* Header */}
        <div className="text-center mb-8">
          <div
            className="w-14 h-14 rounded-2xl flex items-center justify-center mx-auto mb-4 text-2xl"
            style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.25)' }}
          >
            🇩🇪
          </div>
          <h1
            className="text-2xl font-bold mb-1"
            style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
          >
            Willkommen zurück
          </h1>
          <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
            Melde dich an und lerne weiter
          </p>
        </div>

        <form onSubmit={handleLogin} className="space-y-4">
          {/* Email */}
          <div className="space-y-1.5">
            <label
              htmlFor="email"
              className="block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              E-Mail
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoComplete="username"
              disabled={isLocked}
              placeholder="du@beispiel.de"
              className="w-full px-4 py-3 rounded-xl text-sm transition-all"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
              }}
              aria-label="E-Mail Adresse"
            />
          </div>

          {/* Password */}
          <div className="space-y-1.5">
            <label
              htmlFor="password"
              className="block text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--text-muted)' }}
            >
              Passwort
            </label>
            <div className="relative">
              <input
                id="password"
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                autoComplete="current-password"
                disabled={isLocked}
                placeholder="••••••••"
                className="w-full px-4 py-3 pr-11 rounded-xl text-sm transition-all"
                style={{
                  background: 'var(--glass-bg)',
                  border: '1px solid var(--glass-border)',
                  color: 'var(--text-primary)',
                  fontFamily: 'var(--font-body)',
                }}
                aria-label="Passwort"
              />
              <button
                type="button"
                onClick={() => setShowPassword((s) => !s)}
                className="absolute right-3 top-1/2 -translate-y-1/2 transition-colors hover:opacity-100"
                style={{ color: 'var(--text-muted)', opacity: 0.7 }}
                aria-label={showPassword ? 'Passwort verbergen' : 'Passwort anzeigen'}
              >
                {showPassword ? (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} className="w-4 h-4">
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                  </svg>
                )}
              </button>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div
              className="rounded-xl p-3.5 animate-slide-down"
              style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}
            >
              <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
              {isLocked && countdown > 0 && (
                <p className="text-xs mt-1 font-mono" style={{ color: 'rgba(239,68,68,0.7)' }}>
                  {Math.floor(countdown / 60)}:{String(countdown % 60).padStart(2, '0')} verbleibend
                </p>
              )}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || isLocked}
            className="w-full py-3 rounded-xl text-sm font-semibold transition-all animate-pulse-glow"
            style={{
              background: loading || isLocked ? 'rgba(245,158,11,0.3)' : 'var(--amber)',
              color: '#0a0c12',
              fontFamily: 'var(--font-display)',
              cursor: loading || isLocked ? 'not-allowed' : 'pointer',
            }}
          >
            {isLocked ? 'Gesperrt' : loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
                Wird eingeloggt…
              </span>
            ) : 'Einloggen'}
          </button>
        </form>

        <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
          Noch kein Konto?{' '}
          <Link
            href="/signup"
            className="font-semibold transition-colors hover:opacity-80"
            style={{ color: 'var(--amber)' }}
          >
            Registrieren
          </Link>
        </p>
      </div>
    </>
  );
}
