type LogLevel = 'info' | 'warn' | 'error';

interface LogEntry {
  timestamp: string;
  level: LogLevel;
  event: string;
  context?: Record<string, unknown>;
  error?: { message: string; stack?: string };
}

const isDev = process.env.NODE_ENV !== 'production';

function emit(entry: LogEntry) {
  if (isDev) {
    const prefix = { info: 'ℹ️', warn: '⚠️', error: '❌' }[entry.level];
    console.log(`${prefix} [${entry.event}]`, entry.context ?? '', entry.error?.message ?? '');
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
