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

async function checkAzure(): Promise<'ok' | 'down' | 'not_configured'> {
  try {
    const endpoint = process.env.AZURE_OPENAI_ENDPOINT;
    const apiKey = process.env.AZURE_OPENAI_API_KEY;
    if (!endpoint || !apiKey) return 'not_configured';
    const url = `${endpoint}/openai/models?api-version=2024-06-01`;
    const res = await fetch(url, {
      headers: { 'api-key': apiKey },
      signal: AbortSignal.timeout(3000),
    });
    // <500 means Azure is reachable (200=ok, 401=reachable but key issue)
    return res.status < 500 ? 'ok' : 'down';
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
  const [database, redis, azure] = await Promise.all([
    checkSupabase(),
    checkRedis(),
    checkAzure(),
  ]);

  const critical = database === 'ok' && azure !== 'down';
  const overall = critical ? 'ok' : 'degraded';

  return NextResponse.json(
    {
      status: overall,
      checks: { database, redis, azure },
      timestamp: new Date().toISOString(),
      version: '1.0.0',
    },
    { status: overall === 'ok' ? 200 : 503 }
  );
}
