import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  // Fetch user profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('*')
    .eq('id', user!.id)
    .single();

  // Fetch enrollments with course info
  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('*, course:courses(*)')
    .eq('user_id', user!.id)
    .order('enrolled_at', { ascending: false })
    .limit(5);

  // Fetch recent tutor messages
  const { data: recentMessages } = await supabase
    .from('messages')
    .select('*')
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false })
    .limit(5);

  const firstName = profile?.full_name?.split(' ')[0] || 'there';

  return (
    <div className="space-y-8">
      {/* Welcome */}
      <div>
        <h1 className="text-2xl font-bold text-white">
          Willkommen, {firstName}!
        </h1>
        <p className="text-slate-400 mt-1">
          Continue your German learning journey.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <Link
          href="/tutor"
          className="bg-gradient-to-br from-blue-600/20 to-blue-700/10 border border-blue-500/20 rounded-xl p-5 hover:border-blue-500/40 transition-colors group"
        >
          <div className="text-blue-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold group-hover:text-blue-300 transition-colors">
            Practice Text
          </h3>
          <p className="text-slate-500 text-sm mt-1">Get instant corrections</p>
        </Link>

        <Link
          href="/tutor"
          className="bg-gradient-to-br from-purple-600/20 to-purple-700/10 border border-purple-500/20 rounded-xl p-5 hover:border-purple-500/40 transition-colors group"
        >
          <div className="text-purple-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
            </svg>
          </div>
          <h3 className="text-white font-semibold group-hover:text-purple-300 transition-colors">
            Practice Speaking
          </h3>
          <p className="text-slate-500 text-sm mt-1">Record &amp; get feedback</p>
        </Link>

        <Link
          href="/courses"
          className="bg-gradient-to-br from-emerald-600/20 to-emerald-700/10 border border-emerald-500/20 rounded-xl p-5 hover:border-emerald-500/40 transition-colors group"
        >
          <div className="text-emerald-400 mb-2">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
            </svg>
          </div>
          <h3 className="text-white font-semibold group-hover:text-emerald-300 transition-colors">
            Browse Courses
          </h3>
          <p className="text-slate-500 text-sm mt-1">Structured lessons</p>
        </Link>
      </div>

      {/* Enrolled courses */}
      {enrollments && enrollments.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Your Courses</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {enrollments.map((enrollment: Record<string, unknown>) => {
              const course = enrollment.course as Record<string, unknown> | null;
              if (!course) return null;
              return (
                <Link
                  key={enrollment.id as string}
                  href={`/courses/${course.id}`}
                  className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
                >
                  <div className="flex items-center justify-between mb-2">
                    <h3 className="text-white font-medium">{course.title as string}</h3>
                    <span className="text-xs px-2 py-0.5 bg-blue-500/20 text-blue-400 rounded-full">
                      {course.level as string}
                    </span>
                  </div>
                  <div className="w-full bg-white/10 rounded-full h-1.5 mt-3">
                    <div
                      className="bg-blue-500 h-1.5 rounded-full transition-all"
                      style={{ width: `${enrollment.progress as number}%` }}
                    />
                  </div>
                  <p className="text-slate-500 text-xs mt-1">{enrollment.progress as number}% complete</p>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Recent activity */}
      {recentMessages && recentMessages.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Recent Corrections</h2>
          <div className="space-y-3">
            {recentMessages.map((msg: Record<string, unknown>) => (
              <div
                key={msg.id as string}
                className="bg-white/5 border border-white/10 rounded-xl p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    msg.input_type === 'text'
                      ? 'bg-blue-500/20 text-blue-400'
                      : msg.input_type === 'audio'
                      ? 'bg-purple-500/20 text-purple-400'
                      : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {msg.input_type as string}
                  </span>
                  <span className="text-slate-500 text-xs">
                    {new Date(msg.created_at as string).toLocaleDateString()}
                  </span>
                </div>
                <p className="text-slate-400 text-sm truncate">
                  {(msg.original_content as string)?.substring(0, 100)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Empty state */}
      {(!enrollments || enrollments.length === 0) && (!recentMessages || recentMessages.length === 0) && (
        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
          <p className="text-slate-400 mb-4">You haven&apos;t started learning yet. Let&apos;s begin!</p>
          <Link
            href="/tutor"
            className="inline-block px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-semibold rounded-xl transition-colors"
          >
            Start with AI Tutor
          </Link>
        </div>
      )}
    </div>
  );
}
