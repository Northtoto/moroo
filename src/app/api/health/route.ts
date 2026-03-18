import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

async function checkSupabase(): Promise<'ok' | 'down'> {
  try {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!url || !key) return 'down';
    const sb = createClient(url, key, { auth: { persistSession: false } });
    const { error } = await sb.from('profiles').select('id').limit(1);
    return error ? 'down' : 'ok';
  } catch {
    return 'down';
  }
}

async function checkRedis(): Promise<'ok' | 'down' | 'not_configured'> {
  try {
    const url = process.env.UPSTASH_REDIS_REST_URL;
    const token = process.env.UPSTASH_REDIS_REST_TOKEN;
    if (!url || !token) return 'not_configured';
    const res = await fetch(`${url}/ping`, {
      headers: { Authorization: `Bearer ${token}` },
      signal: AbortSignal.timeout(3000),
    });
    return res.ok ? 'ok' : 'down';
  } catch {
    return 'down';
  }
}

export async function GET() {
  const [database, redis] = await Promise.all([checkSupabase(), checkRedis()]);

  const overall = database === 'ok' ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status: overall,
      checks: { database, redis },
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: overall === 'ok' ? 200 : 503 }
  );
}
