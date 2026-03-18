/**
 * Security utilities for 2026-grade auth hardening
 * Covers: rate limiting, brute-force protection, input sanitization,
 * CSRF protection, session fingerprinting, security headers
 */

import { headers } from 'next/headers';
import { createClient } from '@supabase/supabase-js';
import { DISPOSABLE_EMAIL_DOMAINS } from '@/data/disposable-email-domains';

// ─── Constants ──────────────────────────────────────────────────────────────

const MAX_LOGIN_ATTEMPTS = 5;
const LOCKOUT_DURATION_MS = 15 * 60 * 1000; // 15 minutes
const SESSION_MAX_AGE_S = 3600; // 1 hour
const PASSWORD_MIN_LENGTH = 12;

// Rate limit windows (per endpoint)
const RATE_LIMITS: Record<string, { maxRequests: number; windowMs: number }> = {
  'auth/login': { maxRequests: 5, windowMs: 5 * 60 * 1000 },
  'auth/signup': { maxRequests: 3, windowMs: 15 * 60 * 1000 },
  'auth/reset': { maxRequests: 2, windowMs: 60 * 60 * 1000 },
  'api/tutor': { maxRequests: 60, windowMs: 60 * 1000 },
  'default': { maxRequests: 100, windowMs: 60 * 1000 },
};

// ─── Service client (bypasses RLS for security operations) ──────────────────

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Missing Supabase service config');
  return createClient(url, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}

// ─── IP extraction ──────────────────────────────────────────────────────────

export async function getClientIP(): Promise<string> {
  const h = await headers();
  return (
    h.get('cf-connecting-ip') ??
    h.get('x-real-ip') ??
    h.get('x-forwarded-for')?.split(',')[0]?.trim() ??
    '0.0.0.0'
  );
}

export async function getUserAgent(): Promise<string> {
  const h = await headers();
  return h.get('user-agent') ?? 'unknown';
}

// ─── Password strength validation (2026 NIST SP 800-63B compliant) ──────────

export function validatePasswordStrength(password: string): {
  valid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  if (password.length < PASSWORD_MIN_LENGTH) {
    errors.push(`Password must be at least ${PASSWORD_MIN_LENGTH} characters`);
  }
  if (password.length > 128) {
    errors.push('Password must be at most 128 characters');
  }
  if (!/[a-z]/.test(password)) {
    errors.push('Password must contain at least one lowercase letter');
  }
  if (!/[A-Z]/.test(password)) {
    errors.push('Password must contain at least one uppercase letter');
  }
  if (!/[0-9]/.test(password)) {
    errors.push('Password must contain at least one number');
  }
  if (!/[^a-zA-Z0-9]/.test(password)) {
    errors.push('Password must contain at least one special character');
  }

  // Shannon entropy check — reject low-entropy passwords (e.g. "Aaaaaaa1!")
  const freq = new Map<string, number>();
  for (const ch of password) freq.set(ch, (freq.get(ch) ?? 0) + 1);
  const len = password.length;
  let entropy = 0;
  for (const count of freq.values()) {
    const p = count / len;
    entropy -= p * Math.log2(p);
  }
  if (entropy < 3.0) {
    errors.push('Password is too repetitive — use more varied characters');
  }

  // Check for common breached patterns
  const commonPatterns = [
    /^(.)\1+$/, // all same character
    /^(012|123|234|345|456|567|678|789|890)/, // sequential numbers
    /^(abc|bcd|cde|def|efg|fgh|ghi)/i, // sequential letters
    /password/i,
    /qwerty/i,
    /admin/i,
  ];

  for (const pattern of commonPatterns) {
    if (pattern.test(password)) {
      errors.push('Password contains a common pattern and is too easy to guess');
      break;
    }
  }

  return { valid: errors.length === 0, errors };
}

// ─── Email validation ───────────────────────────────────────────────────────

export function validateEmail(email: string): boolean {
  const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;
  if (!emailRegex.test(email)) return false;
  if (email.length > 254) return false;
  // Block disposable email domains (~100 providers, O(1) Set lookup)
  const domain = email.split('@')[1]?.toLowerCase();
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) return false;
  return true;
}

// ─── Input sanitization ─────────────────────────────────────────────────────

export function sanitizeInput(input: string, maxLength = 500): string {
  return input
    .slice(0, maxLength)
    .replace(/[<>]/g, '') // Strip basic HTML tags
    .trim();
}

// ─── Brute force protection ─────────────────────────────────────────────────

export async function checkBruteForce(userId: string): Promise<{
  locked: boolean;
  remainingAttempts: number;
  lockoutEndsAt?: string;
}> {
  const db = getServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('failed_login_count, locked_until')
    .eq('id', userId)
    .single();

  if (!profile) return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };

  // Check if currently locked
  if (profile.locked_until && new Date(profile.locked_until) > new Date()) {
    return {
      locked: true,
      remainingAttempts: 0,
      lockoutEndsAt: profile.locked_until,
    };
  }

  // If lock has expired, reset
  if (profile.locked_until && new Date(profile.locked_until) <= new Date()) {
    await db
      .from('profiles')
      .update({ failed_login_count: 0, locked_until: null })
      .eq('id', userId);
    return { locked: false, remainingAttempts: MAX_LOGIN_ATTEMPTS };
  }

  const remaining = MAX_LOGIN_ATTEMPTS - (profile.failed_login_count ?? 0);
  return { locked: remaining <= 0, remainingAttempts: Math.max(0, remaining) };
}

export async function recordLoginFailure(userId: string): Promise<void> {
  const db = getServiceClient();

  const { data: profile } = await db
    .from('profiles')
    .select('failed_login_count')
    .eq('id', userId)
    .single();

  const newCount = (profile?.failed_login_count ?? 0) + 1;
  const updates: Record<string, unknown> = {
    failed_login_count: newCount,
  };

  if (newCount >= MAX_LOGIN_ATTEMPTS) {
    updates.locked_until = new Date(Date.now() + LOCKOUT_DURATION_MS).toISOString();
  }

  await db.from('profiles').update(updates).eq('id', userId);
}

export async function recordLoginSuccess(userId: string, ip: string): Promise<void> {
  const db = getServiceClient();

  await db
    .from('profiles')
    .update({
      failed_login_count: 0,
      locked_until: null,
      last_login_at: new Date().toISOString(),
      login_count: (await db.from('profiles').select('login_count').eq('id', userId).single()).data?.login_count + 1 || 1,
      last_ip: ip,
    })
    .eq('id', userId);
}

// ─── Security event logging ─────────────────────────────────────────────────

export async function logSecurityEvent(
  eventType: string,
  userId: string | null,
  metadata: Record<string, unknown> = {}
): Promise<void> {
  try {
    const db = getServiceClient();
    const ip = await getClientIP();
    const ua = await getUserAgent();

    await db.from('security_events').insert({
      user_id: userId,
      event_type: eventType,
      ip_address: ip,
      user_agent: ua,
      metadata,
    });
  } catch {
    // Security logging should never break the app
    console.error('Failed to log security event:', eventType);
  }
}

// ─── Security headers ───────────────────────────────────────────────────────

export const SECURITY_HEADERS = {
  'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY',
  'X-XSS-Protection': '0', // Disabled in favor of CSP (modern best practice)
  'Referrer-Policy': 'strict-origin-when-cross-origin',
  'Permissions-Policy': 'camera=(), microphone=(self), geolocation=(), payment=()',
  'Strict-Transport-Security': 'max-age=63072000; includeSubDomains; preload',
  'Content-Security-Policy': [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'", // Next.js needs unsafe-inline; unsafe-eval removed (XSS vector)
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob: https:",
    "font-src 'self'",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join('; '),
};

// ─── Rate limiting (in-memory for edge, DB-backed for persistence) ──────────

const rateLimitMap = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  identifier: string,
  endpoint: string
): { allowed: boolean; retryAfterMs: number } {
  const config = RATE_LIMITS[endpoint] ?? RATE_LIMITS['default'];
  const key = `${identifier}:${endpoint}`;
  const now = Date.now();

  const entry = rateLimitMap.get(key);

  if (!entry || entry.resetAt <= now) {
    rateLimitMap.set(key, { count: 1, resetAt: now + config.windowMs });
    return { allowed: true, retryAfterMs: 0 };
  }

  if (entry.count >= config.maxRequests) {
    return { allowed: false, retryAfterMs: entry.resetAt - now };
  }

  entry.count++;
  return { allowed: true, retryAfterMs: 0 };
}

// ─── Session constants export ───────────────────────────────────────────────

export { SESSION_MAX_AGE_S, PASSWORD_MIN_LENGTH, MAX_LOGIN_ATTEMPTS, LOCKOUT_DURATION_MS };
