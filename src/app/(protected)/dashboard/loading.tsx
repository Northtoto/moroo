// Shown automatically by Next.js while dashboard/page.tsx fetches Supabase data
export default function DashboardLoading() {
  return (
    <div className="space-y-8 animate-pulse">
      {/* Welcome header skeleton */}
      <div>
        <div className="h-8 w-56 bg-white/10 rounded-lg" />
        <div className="h-4 w-40 bg-white/5 rounded mt-2" />
      </div>

      {/* Quick action cards skeleton — mirrors 1-col → 3-col grid */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        {[...Array(3)].map((_, i) => (
          <div
            key={i}
            className="border border-white/10 rounded-xl p-5 bg-white/5 h-24"
          />
        ))}
      </div>

      {/* Enrollments section skeleton */}
      <div>
        <div className="h-5 w-32 bg-white/10 rounded mb-4" />
        <div className="space-y-3">
          {[...Array(3)].map((_, i) => (
            <div
              key={i}
              className="border border-white/10 rounded-xl p-4 bg-white/5 flex items-center gap-4"
            >
              <div className="w-10 h-10 rounded-lg bg-white/10 flex-shrink-0" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-3/4 bg-white/10 rounded" />
                <div className="h-3 w-1/2 bg-white/5 rounded" />
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Recent messages skeleton */}
      <div>
        <div className="h-5 w-40 bg-white/10 rounded mb-4" />
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 bg-white/5 border border-white/10 rounded-xl" />
          ))}
        </div>
      </div>
    </div>
  );
}
