'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense } from 'react';

function AccessDeniedContent() {
  const searchParams = useSearchParams();
  const reason = searchParams.get('reason');

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center p-4">
      <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10 max-w-md w-full text-center">
        {/* Red X Icon */}
        <div className="flex justify-center mb-6">
          <div className="w-20 h-20 rounded-full bg-red-500/20 border border-red-500/30 flex items-center justify-center">
            <svg
              className="w-10 h-10 text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>

        {/* Heading */}
        <h1 className="text-2xl font-bold text-white mb-3">
          Access Not Granted
        </h1>

        {/* Subtext */}
        <p className="text-slate-400 mb-6 leading-relaxed">
          Your account was reviewed but access could not be granted at this time.
        </p>

        {/* Rejection reason (if provided) */}
        {reason === 'rejected' && (
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 mb-6 text-left">
            <p className="text-sm text-red-300 font-medium mb-1">Reason</p>
            <p className="text-sm text-slate-300">
              Your account was not approved. This may be because we could not
              verify your Skool community membership.
            </p>
          </div>
        )}

        {/* What to do */}
        <div className="bg-white/5 rounded-xl p-5 mb-6 text-left">
          <p className="text-sm font-semibold text-slate-300 mb-3">
            What can I do?
          </p>
          <ul className="space-y-2">
            <li className="flex items-start gap-2 text-sm text-slate-400">
              <span className="text-blue-400 mt-0.5 flex-shrink-0">1.</span>
              <span>
                Ensure you purchased the course on{' '}
                <span className="text-white font-medium">Skool</span> and used
                the same email address when signing up.
              </span>
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-400">
              <span className="text-blue-400 mt-0.5 flex-shrink-0">2.</span>
              <span>Contact our support team to appeal this decision.</span>
            </li>
            <li className="flex items-start gap-2 text-sm text-slate-400">
              <span className="text-blue-400 mt-0.5 flex-shrink-0">3.</span>
              <span>
                If you believe this is a mistake, we will review your case
                promptly.
              </span>
            </li>
          </ul>
        </div>

        {/* CTA Buttons */}
        <div className="flex flex-col gap-3">
          <a
            href="mailto:support@morodeutsch.com?subject=Access%20Appeal%20Request"
            className="w-full py-3 px-4 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-all duration-200 text-sm"
          >
            Contact Support
          </a>
          <Link
            href="/login"
            className="w-full py-3 px-4 bg-white/5 hover:bg-white/10 text-slate-300 font-medium rounded-xl border border-white/10 transition-all duration-200 text-sm"
          >
            Back to Login
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function AccessDeniedPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 flex items-center justify-center">
          <div className="text-slate-400">Loading...</div>
        </div>
      }
    >
      <AccessDeniedContent />
    </Suspense>
  );
}
