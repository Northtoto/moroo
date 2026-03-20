import { NextRequest, NextResponse } from 'next/server';
import { logger } from '@/lib/logger';
import { getMetrics, resetMetrics } from '@/lib/metrics-collector';

// Re-export recordMetric so other routes can import from either location
export { recordMetric } from '@/lib/metrics-collector';

const METRICS_KEY = process.env.METRICS_API_KEY;

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

function isAuthorized(request: NextRequest): boolean {
  // If no key is configured, deny all access
  if (!METRICS_KEY) {
    logger.warn('metrics:auth', { message: 'METRICS_API_KEY not configured' });
    return false;
  }

  const provided =
    request.headers.get('x-metrics-key') ??
    request.headers.get('authorization')?.replace(/^Bearer\s+/i, '');

  return provided === METRICS_KEY;
}

// ---------------------------------------------------------------------------
// GET /api/metrics — return aggregated tutor performance metrics
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    logger.warn('metrics:unauthorized', {
      ip: request.headers.get('x-forwarded-for') ?? 'unknown',
    });
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const metrics = getMetrics();
    logger.info('metrics:read', { total: metrics.tutor_requests_today });
    return NextResponse.json(metrics, { status: 200 });
  } catch (err) {
    logger.error('metrics:read:error', err instanceof Error ? err : new Error(String(err)), {});
    return NextResponse.json(
      { error: 'Failed to retrieve metrics' },
      { status: 500 },
    );
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/metrics — reset all collected metrics
// ---------------------------------------------------------------------------

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  resetMetrics();
  logger.info('metrics:deleted', { message: 'Metrics reset via API' });
  return NextResponse.json({ ok: true }, { status: 200 });
}
