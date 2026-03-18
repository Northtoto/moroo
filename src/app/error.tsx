'use client';

import { useEffect } from 'react';

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error('[error-boundary] Unhandled error:', error);
  }, [error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <h1 className="text-2xl font-bold text-gray-800 mb-4">
          Etwas ist schiefgelaufen
        </h1>
        <p className="text-gray-600 mb-6">
          Ein unerwarteter Fehler ist aufgetreten. Bitte lade die Seite neu oder versuche es
          sp&auml;ter erneut.
        </p>
        <button
          onClick={reset}
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Seite neu laden
        </button>
        {error.digest && (
          <p className="mt-4 text-xs text-gray-400">Fehler-ID: {error.digest}</p>
        )}
      </div>
    </div>
  );
}
