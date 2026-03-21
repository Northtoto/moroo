// Shown automatically by Next.js while courses/page.tsx fetches from Supabase
export default function CoursesLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Page title skeleton */}
      <div>
        <div className="h-8 w-40 bg-white/10 rounded-lg" />
        <div className="h-4 w-64 bg-white/5 rounded mt-2" />
      </div>

      {/* Course cards grid — mirrors grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {[...Array(6)].map((_, i) => (
          <div
            key={i}
            className="border border-white/10 rounded-2xl overflow-hidden bg-white/5"
          >
            {/* Course image area */}
            <div className="h-36 bg-white/10" />
            <div className="p-5 space-y-3">
              {/* Level badge */}
              <div className="h-5 w-12 bg-white/10 rounded-full" />
              {/* Title */}
              <div className="h-5 w-3/4 bg-white/10 rounded" />
              {/* Description lines */}
              <div className="h-3 w-full bg-white/5 rounded" />
              <div className="h-3 w-2/3 bg-white/5 rounded" />
              {/* Progress bar */}
              <div className="h-2 w-full bg-white/10 rounded-full mt-4" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
