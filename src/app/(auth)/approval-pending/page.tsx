export default function ApprovalPendingPage() {
  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl p-8 shadow-2xl border border-white/10 max-w-md w-full mx-auto text-center">
      {/* Icon */}
      <div className="flex items-center justify-center w-16 h-16 rounded-full bg-yellow-500/10 border border-yellow-500/20 mx-auto mb-6">
        <svg
          className="w-8 h-8 text-yellow-400"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M12 6v6l4 2m6-2a10 10 0 11-20 0 10 10 0 0120 0z"
          />
        </svg>
      </div>

      {/* Heading */}
      <h1 className="text-2xl font-bold text-white mb-2">Account Under Review</h1>
      <p className="text-slate-400 mb-6 leading-relaxed">
        Your account has been created and is currently being reviewed.
        This typically takes <span className="text-white font-medium">1–2 business hours</span>.
      </p>

      {/* Status card */}
      <div className="bg-yellow-500/5 border border-yellow-500/20 rounded-xl p-4 mb-6 text-left">
        <p className="text-sm font-medium text-yellow-400 mb-2">What happens next?</p>
        <ul className="space-y-1.5 text-sm text-slate-400">
          <li className="flex items-start gap-2">
            <span className="text-yellow-500 mt-0.5">✓</span>
            Your email has been verified
          </li>
          <li className="flex items-start gap-2">
            <span className="text-yellow-400 mt-0.5">⋯</span>
            Our team is verifying your Skool membership
          </li>
          <li className="flex items-start gap-2">
            <span className="text-slate-500 mt-0.5">○</span>
            You&apos;ll receive an email once approved
          </li>
        </ul>
      </div>

      <p className="text-xs text-slate-500">
        Already received approval?{' '}
        <a
          href="/login"
          className="text-blue-400 hover:text-blue-300 underline underline-offset-2"
        >
          Sign in again
        </a>
      </p>
    </div>
  );
}
