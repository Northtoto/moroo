'use client';

import { useEffect } from 'react';

export default function ProtectedError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary:protected] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">📚</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-gray-600 mb-6">
          Beim Laden dieser Seite ist ein Fehler aufgetreten. Bitte versuche es erneut.
        </p>
        <div className="flex gap-3 justify-center">
          <button
            onClick={reset}
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Erneut versuchen
          </button>
          <a
            href="/dashboard"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Zum Dashboard
          </a>
        </div>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">Fehler-ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
