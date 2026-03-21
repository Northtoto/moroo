import { describe, it, expect, vi, beforeEach } from 'vitest';

// Must mock before importing the route
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => ({
    from: vi.fn(() => ({
      upsert: vi.fn().mockResolvedValue({ error: null }),
      update: vi.fn(() => ({ eq: vi.fn().mockResolvedValue({ error: null }) })),
      select: vi.fn(() => ({
        eq: vi.fn(() => ({
          single: vi.fn().mockResolvedValue({ data: null, error: null }),
        })),
      })),
    })),
  })),
}));

vi.mock('@/lib/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

describe('POST /api/skool/verify — secret validation', () => {
  beforeEach(() => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'service-key';
    process.env.SKOOL_WEBHOOK_SECRET = 'correct-secret-32chars-padded000';
  });

  it('returns 401 when secret is wrong', async () => {
    const { POST } = await import('@/app/api/skool/verify/route');
    const req = new Request('http://localhost/api/skool/verify', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com', secret: 'wrong-secret' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 400 when email is missing', async () => {
    const { POST } = await import('@/app/api/skool/verify/route');
    const req = new Request('http://localhost/api/skool/verify', {
      method: 'POST',
      body: JSON.stringify({ secret: 'correct-secret-32chars-padded000' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 400 when secret is missing', async () => {
    const { POST } = await import('@/app/api/skool/verify/route');
    const req = new Request('http://localhost/api/skool/verify', {
      method: 'POST',
      body: JSON.stringify({ email: 'user@test.com' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(400);
  });

  it('returns 200 with pre_authorized when user does not exist yet', async () => {
    const { POST } = await import('@/app/api/skool/verify/route');
    const req = new Request('http://localhost/api/skool/verify', {
      method: 'POST',
      body: JSON.stringify({ email: 'new@test.com', secret: 'correct-secret-32chars-padded000' }),
      headers: { 'Content-Type': 'application/json' },
    });
    const res = await POST(req as any);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('pre_authorized');
  });
});
