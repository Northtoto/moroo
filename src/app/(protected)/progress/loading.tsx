// Shown automatically by Next.js while progress/page.tsx fetches stats from Supabase
export default function ProgressLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Page title skeleton */}
      <div>
        <div className="h-8 w-40 bg-white/10 rounded-lg" />
        <div className="h-4 w-52 bg-white/5 rounded mt-2" />
      </div>

      {/* Stats row — 3 cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border border-white/10 rounded-xl p-5 bg-white/5 space-y-2"
          >
            <div className="h-4 w-20 bg-white/10 rounded" />
            <div className="h-8 w-16 bg-white/15 rounded" />
          </div>
        ))}
      </div>

      {/* Radar chart placeholder */}
      <div className="border border-white/10 rounded-2xl p-6 bg-white/5">
        <div className="h-5 w-36 bg-white/10 rounded mb-4" />
        <div className="h-64 bg-white/5 rounded-xl" />
      </div>

      {/* Badges section */}
      <div>
        <div className="h-5 w-28 bg-white/10 rounded mb-4" />
        <div className="flex flex-wrap gap-3">
          {[...Array(6)].map((_, i) => (
            <div key={i} className="h-10 w-24 bg-white/5 border border-white/10 rounded-full" />
          ))}
        </div>
      </div>
    </div>
  );
}
