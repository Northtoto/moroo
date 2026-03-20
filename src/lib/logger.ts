type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  requestId?: string;
  context?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

const isDev = process.env.NODE_ENV !== 'production';

function emit(entry: LogEntry) {
  if (isDev) {
    const prefix = { info: 'ℹ️', warn: '⚠️', error: '❌' }[entry.level];
    const rid = entry.requestId ? ` [${entry.requestId.slice(0, 8)}]` : '';
    console.log(`${prefix}${rid} [${entry.event}]`, entry.context ?? '', entry.error?.message ?? '');
  } else {
    const fn = entry.level === 'error' ? console.error : entry.level === 'warn' ? console.warn : console.log;
    fn(JSON.stringify(entry));
  }
}

export const logger = {
  info(event: string, context?: Record<string, unknown>) {
    emit({ timestamp: new Date().toISOString(), level: 'info', event, context });
  },
  warn(event: string, context?: Record<string, unknown>) {
    emit({ timestamp: new Date().toISOString(), level: 'warn', event, context });
  },
  error(event: string, err?: unknown, context?: Record<string, unknown>) {
    const error = err instanceof Error
      ? { message: err.message, stack: err.stack }
      : { message: String(err) };
    emit({ timestamp: new Date().toISOString(), level: 'error', event, context, error });
  },
};

// ─── Request-scoped logger ────────────────────────────────────────────────────
// Creates a logger bound to a single requestId so all logs for one API call
// can be traced together in production log queries.

export function generateRequestId(): string {
  return crypto.randomUUID();
}

export function createRequestLogger(requestId: string) {
  return {
    info(event: string, context?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: 'info', event, requestId, context });
    },
    warn(event: string, context?: Record<string, unknown>) {
      emit({ timestamp: new Date().toISOString(), level: 'warn', event, requestId, context });
    },
    error(event: string, err?: unknown, context?: Record<string, unknown>) {
      const error = err instanceof Error
        ? { message: err.message, stack: err.stack }
        : { message: String(err) };
      emit({ timestamp: new Date().toISOString(), level: 'error', event, requestId, context, error });
    },
  };
}
