import Link from 'next/link';

// Global 404 — shown when any unmatched route is hit.
// Server Component (no 'use client' needed — no interactivity).
export default function NotFound() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
      <div className="text-center max-w-md">
        <div className="text-5xl mb-4">🔍</div>
        <h1 className="text-2xl font-bold text-gray-800 mb-2">
          Seite nicht gefunden
        </h1>
        <p className="text-gray-500 text-4xl font-mono font-bold mb-4">404</p>
        <p className="text-gray-600 mb-6">
          Diese Seite existiert nicht oder wurde verschoben.
          Vielleicht hilft ein Blick auf das Dashboard weiter.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/dashboard"
            className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            Zum Dashboard
          </Link>
          <Link
            href="/"
            className="px-6 py-3 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-100 transition-colors"
          >
            Startseite
          </Link>
        </div>
      </div>
    </div>
  );
}
