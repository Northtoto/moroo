import { createClient } from '@/lib/supabase/server';
import Link from 'next/link';

const levelColors: Record<string, string> = {
  A1: 'bg-green-500/20 text-green-400',
  A2: 'bg-emerald-500/20 text-emerald-400',
  B1: 'bg-blue-500/20 text-blue-400',
  B2: 'bg-indigo-500/20 text-indigo-400',
  C1: 'bg-purple-500/20 text-purple-400',
  C2: 'bg-pink-500/20 text-pink-400',
};

export default async function CoursesPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: courses } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('level', { ascending: true });

  const { data: enrollments } = await supabase
    .from('enrollments')
    .select('course_id, progress')
    .eq('user_id', user!.id);

  const enrolledMap = new Map(
    enrollments?.map((e: { course_id: string; progress: number }) => [e.course_id, e.progress]) || []
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white">Courses</h1>
        <p className="text-slate-400 mt-1">
          Structured German lessons from beginner to advanced.
        </p>
      </div>

      {courses && courses.length > 0 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {courses.map((course: Record<string, unknown>) => {
            const isEnrolled = enrolledMap.has(course.id as string);
            const progress = enrolledMap.get(course.id as string) || 0;
            return (
              <Link
                key={course.id as string}
                href={`/courses/${course.id}`}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-colors group"
              >
                {course.image_url ? (
                  <div className="h-36 bg-white/5 overflow-hidden">
                    <img
                      src={course.image_url as string}
                      alt={course.title as string}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                ) : null}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      levelColors[course.level as string] || 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {course.level as string}
                    </span>
                    {isEnrolled && (
                      <span className="text-xs text-green-400">Enrolled</span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold mt-1 group-hover:text-blue-300 transition-colors">
                    {course.title as string}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 line-clamp-2">
                    {course.description as string}
                  </p>
                  {isEnrolled && (
                    <div className="mt-3">
                      <div className="w-full bg-white/10 rounded-full h-1.5">
                        <div
                          className="bg-blue-500 h-1.5 rounded-full"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                      <p className="text-slate-500 text-xs mt-1">{progress}% complete</p>
                    </div>
                  )}
                </div>
              </Link>
            );
          })}
        </div>
      ) : (
        <div className="text-center py-12 bg-white/5 rounded-xl border border-white/10">
          <p className="text-slate-400">No courses available yet. Check back soon!</p>
        </div>
      )}
    </div>
  );
}
