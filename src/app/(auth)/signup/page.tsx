'use client';

import { useState, useMemo, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

// ─── Types ───────────────────────────────────────────────────────────────────

type Goal = 'tourism' | 'work' | 'university' | 'family';
type CefrLevel = 'A1' | 'A2' | 'B1' | 'B2' | 'C1' | 'C2';

const CEFR_LEVELS: { id: CefrLevel; label: string }[] = [
  { id: 'A1', label: 'Beginner' },
  { id: 'A2', label: 'Elementary' },
  { id: 'B1', label: 'Intermediate' },
  { id: 'B2', label: 'Upper-Int.' },
  { id: 'C1', label: 'Advanced' },
  { id: 'C2', label: 'Proficient' },
];

interface GoalOption {
  id: Goal;
  emoji: string;
  label: string;
  sublabel: string;
}

// ─── Constants ───────────────────────────────────────────────────────────────

const GOALS: GoalOption[] = [
  { id: 'tourism',    emoji: '🏖️', label: 'Tourism',    sublabel: 'Travel & explore' },
  { id: 'work',       emoji: '💼', label: 'Work',       sublabel: 'Career & business' },
  { id: 'university', emoji: '🎓', label: 'University', sublabel: 'Study & research' },
  { id: 'family',     emoji: '👨‍👩‍👧', label: 'Family',    sublabel: 'Connect & belong' },
];

// ─── Password Strength ───────────────────────────────────────────────────────

function getPasswordStrength(pw: string): { score: number; label: string; color: string } {
  if (pw.length === 0) return { score: 0, label: '', color: '' };
  if (pw.length < 6)  return { score: 1, label: 'Too short', color: '#EF4444' };
  if (pw.length < 8)  return { score: 2, label: 'Weak',      color: '#F97316' };
  const strong = /[A-Z]/.test(pw) && /[0-9]/.test(pw) && /[^a-zA-Z0-9]/.test(pw);
  if (strong)         return { score: 4, label: 'Strong',    color: '#10B981' };
                      return { score: 3, label: 'Good',      color: '#F59E0B' };
}

// ─── Success View ────────────────────────────────────────────────────────────

function SuccessView({ email }: { email: string }) {
  return (
    <div
      className="rounded-3xl p-8 animate-fade-up text-center"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}
    >
      <div
        className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto mb-5 text-3xl"
        style={{ background: 'var(--amber-glow)', border: '1px solid rgba(245,158,11,0.25)' }}
      >
        ✉️
      </div>
      <h1
        className="text-2xl font-bold mb-2"
        style={{ fontFamily: 'var(--font-display)', color: 'var(--text-primary)' }}
      >
        Check your inbox
      </h1>
      <p className="text-sm mb-6" style={{ color: 'var(--text-muted)' }}>
        We sent a confirmation link to{' '}
        <span style={{ color: 'var(--amber)', fontWeight: 600 }}>{email}</span>.
        Click it to activate your account.
      </p>

      <div
        className="rounded-2xl p-4 mb-6 text-left space-y-3"
        style={{ background: 'var(--glass-bg)', border: '1px solid var(--glass-border)' }}
      >
        <p
          className="text-xs font-semibold uppercase tracking-widest mb-2"
          style={{ color: 'var(--text-muted)' }}
        >
          What happens next
        </p>
        {[
          'Click the link in your email to verify your address.',
          'You will be taken directly to your dashboard — no waiting.',
          'Start practising German immediately with AI corrections, flashcards, and more.',
        ].map((step, i) => (
          <div key={i} className="flex items-start gap-3">
            <span
              className="text-xs font-bold flex-shrink-0 w-5 h-5 rounded-full flex items-center justify-center mt-0.5"
              style={{ background: 'var(--amber-glow)', color: 'var(--amber)', border: '1px solid rgba(245,158,11,0.25)', fontFamily: 'var(--font-mono)' }}
            >
              {i + 1}
            </span>
            <span className="text-sm" style={{ color: 'var(--text-muted)' }}>{step}</span>
          </div>
        ))}
      </div>

      <Link
        href="/login"
        className="inline-flex items-center gap-1.5 text-sm font-semibold transition-opacity hover:opacity-80"
        style={{ color: 'var(--amber)' }}
      >
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} className="w-4 h-4">
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
        </svg>
        Back to login
      </Link>
    </div>
  );
}

// ─── Main Component ──────────────────────────────────────────────────────────

function SignupForm() {
  const [fullName, setFullName]     = useState('');
  const [email, setEmail]           = useState('');
  const [password, setPassword]     = useState('');
  const [goal, setGoal]             = useState<Goal | null>(null);
  const [cefrLevel, setCefrLevel]   = useState<CefrLevel | null>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError]           = useState('');
  const [success, setSuccess]       = useState(false);
  const [loading, setLoading]       = useState(false);

  const searchParams = useSearchParams();
  const signupSource = searchParams.get('source') ?? undefined;

  const supabase = createClient();
  const strength = useMemo(() => getPasswordStrength(password), [password]);

  const canSubmit =
    fullName.trim().length >= 2 &&
    email.trim().length > 0 &&
    strength.score >= 3 &&
    goal !== null &&
    cefrLevel !== null &&
    !loading;

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (fullName.trim().length < 2) {
      setError('Full name must be at least 2 characters.');
      return;
    }
    if (strength.score < 3) {
      setError('Password is too weak — use at least 8 characters.');
      return;
    }
    if (!goal) {
      setError('Please select your learning goal.');
      return;
    }

    setLoading(true);

    const { error: authError } = await supabase.auth.signUp({
      email: email.trim().toLowerCase(),
      password,
      options: {
        data: {
          full_name: fullName.trim(),
          learning_goal: goal,
          cefr_level: cefrLevel,
          // Passed to handle_new_user() trigger via raw_user_meta_data->>'signup_source'
          ...(signupSource ? { signup_source: signupSource } : {}),
        },
        emailRedirectTo: `${window.location.origin}/auth/callback`,
      },
    });

    if (authError) {
      if (authError.message.toLowerCase().includes('already')) {
        setError('Unable to create account. Please try a different email or sign in.');
      } else {
        setError(authError.message);
      }
      setLoading(false);
    } else {
      setSuccess(true);
      setLoading(false);
    }
  }

  if (success) return <SuccessView email={email} />;

  return (
    <div
      className="rounded-3xl p-8 animate-fade-up"
      style={{
        background: 'var(--bg-surface)',
        border: '1px solid var(--glass-border)',
        boxShadow: '0 24px 80px rgba(0,0,0,0.4)',
      }}
    >
      {/* ── Header ── */}
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
          Willkommen bei Morodeutsch
        </h1>
        <p className="text-sm" style={{ color: 'var(--text-muted)' }}>
          Create your account and start learning
        </p>
      </div>

      <form onSubmit={handleSignup} className="space-y-5">
        {/* ── Full Name ── */}
        <div className="space-y-1.5">
          <label
            htmlFor="full-name"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Full Name
          </label>
          <input
            id="full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            required
            autoComplete="name"
            placeholder="Your full name"
            className="w-full px-4 py-3 rounded-xl text-sm transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        {/* ── Email ── */}
        <div className="space-y-1.5">
          <label
            htmlFor="email"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Email
          </label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
            placeholder="you@example.com"
            className="w-full px-4 py-3 rounded-xl text-sm transition-all"
            style={{
              background: 'var(--glass-bg)',
              border: '1px solid var(--glass-border)',
              color: 'var(--text-primary)',
              fontFamily: 'var(--font-body)',
            }}
          />
        </div>

        {/* ── Password ── */}
        <div className="space-y-1.5">
          <label
            htmlFor="password"
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Password
          </label>
          <div className="relative">
            <input
              id="password"
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              autoComplete="new-password"
              placeholder="••••••••"
              className="w-full px-4 py-3 pr-11 rounded-xl text-sm transition-all"
              style={{
                background: 'var(--glass-bg)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-primary)',
                fontFamily: 'var(--font-body)',
              }}
            />
            <button
              type="button"
              onClick={() => setShowPassword((s) => !s)}
              className="absolute right-3 top-1/2 -translate-y-1/2 transition-opacity hover:opacity-100"
              style={{ color: 'var(--text-muted)', opacity: 0.7 }}
              aria-label={showPassword ? 'Hide password' : 'Show password'}
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

          {/* Password strength meter */}
          {password.length > 0 && (
            <div className="mt-2 space-y-1.5 animate-slide-down">
              <div className="flex items-center gap-2">
                <div
                  className="flex-1 h-1.5 rounded-full overflow-hidden"
                  style={{ background: 'rgba(255,255,255,0.08)' }}
                >
                  <div
                    className="h-full rounded-full transition-all duration-500"
                    style={{
                      width: `${(strength.score / 4) * 100}%`,
                      background: strength.color,
                      boxShadow: `0 0 8px ${strength.color}40`,
                    }}
                  />
                </div>
                <span
                  className="text-xs font-semibold w-16 text-right"
                  style={{ color: strength.color, fontFamily: 'var(--font-mono)' }}
                >
                  {strength.label}
                </span>
              </div>
              <p className="text-xs" style={{ color: 'var(--text-muted)' }}>
                Use 8+ characters with uppercase, numbers, and symbols for best security.
              </p>
            </div>
          )}
        </div>

        {/* ── Goal Selector ── */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Learning Goal
          </label>
          <div className="grid grid-cols-2 gap-2">
            {GOALS.map((g) => {
              const selected = goal === g.id;
              return (
                <button
                  key={g.id}
                  type="button"
                  onClick={() => setGoal(g.id)}
                  className="relative flex flex-col items-center gap-1 p-3 rounded-2xl text-center transition-all duration-200"
                  style={{
                    background: selected ? 'var(--amber-glow)' : 'var(--glass-bg)',
                    border: selected
                      ? '1px solid rgba(245,158,11,0.35)'
                      : '1px solid var(--glass-border)',
                    boxShadow: selected ? '0 0 16px rgba(245,158,11,0.12)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span className="text-2xl leading-none">{g.emoji}</span>
                  <span
                    className="text-xs font-semibold"
                    style={{
                      color: selected ? 'var(--amber)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-display)',
                    }}
                  >
                    {g.label}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '0.65rem' }}>
                    {g.sublabel}
                  </span>
                  {selected && (
                    <span
                      className="absolute top-2 right-2 w-4 h-4 rounded-full flex items-center justify-center"
                      style={{ background: 'var(--amber)' }}
                    >
                      <svg viewBox="0 0 24 24" fill="none" stroke="#0a0c12" strokeWidth={3} className="w-2.5 h-2.5">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        </div>

        {/* ── CEFR Level Picker ── */}
        <div className="space-y-2">
          <label
            className="block text-xs font-semibold uppercase tracking-wider"
            style={{ color: 'var(--text-muted)' }}
          >
            Mein Deutschniveau
          </label>
          <div className="grid grid-cols-3 gap-2">
            {CEFR_LEVELS.map((c) => {
              const selected = cefrLevel === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  onClick={() => setCefrLevel(c.id)}
                  className="flex flex-col items-center gap-0.5 py-2.5 px-2 rounded-xl text-center transition-all duration-200"
                  style={{
                    background: selected ? 'var(--amber-glow)' : 'var(--glass-bg)',
                    border: selected
                      ? '1px solid rgba(245,158,11,0.35)'
                      : '1px solid var(--glass-border)',
                    boxShadow: selected ? '0 0 12px rgba(245,158,11,0.12)' : 'none',
                    cursor: 'pointer',
                  }}
                >
                  <span
                    className="text-sm font-bold"
                    style={{
                      color: selected ? 'var(--amber)' : 'var(--text-primary)',
                      fontFamily: 'var(--font-mono)',
                    }}
                  >
                    {c.id}
                  </span>
                  <span className="text-xs" style={{ color: 'var(--text-muted)', fontSize: '0.6rem' }}>
                    {c.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* ── Error ── */}
        {error && (
          <div
            className="rounded-xl p-3.5 animate-slide-down"
            style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.20)' }}
          >
            <p className="text-sm" style={{ color: 'var(--danger)' }}>{error}</p>
          </div>
        )}

        {/* ── Submit ── */}
        <button
          type="submit"
          disabled={!canSubmit}
          className="w-full py-3 rounded-xl text-sm font-semibold transition-all"
          style={{
            background: canSubmit ? 'var(--amber)' : 'rgba(245,158,11,0.25)',
            color: '#0a0c12',
            fontFamily: 'var(--font-display)',
            cursor: canSubmit ? 'pointer' : 'not-allowed',
            boxShadow: canSubmit ? '0 0 20px rgba(245,158,11,0.25)' : 'none',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-current border-t-transparent rounded-full animate-spin" />
              Creating account…
            </span>
          ) : (
            'Create Account'
          )}
        </button>
      </form>

      <p className="text-center text-sm mt-6" style={{ color: 'var(--text-muted)' }}>
        Already have an account?{' '}
        <Link
          href="/login"
          className="font-semibold transition-opacity hover:opacity-80"
          style={{ color: 'var(--amber)' }}
        >
          Sign in
        </Link>
      </p>
    </div>
  );
}

// ─── Page Export ─────────────────────────────────────────────────────────────

export default function SignupPage() {
  return (
    <Suspense fallback={null}>
      <SignupForm />
    </Suspense>
  );
}
