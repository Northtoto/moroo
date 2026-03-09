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

  if (!user?.id) {
    throw new Error('User not authenticated');
  }

  const { data: courses, error: coursesError } = await supabase
    .from('courses')
    .select('*')
    .eq('is_published', true)
    .order('level', { ascending: true });

  if (coursesError) {
    throw new Error(`Failed to fetch courses: ${coursesError.message}`);
  }

  const { data: enrollments, error: enrollmentsError } = await supabase
    .from('enrollments')
    .select('course_id, progress')
    .eq('user_id', user.id);

  if (enrollmentsError) {
    throw new Error(`Failed to fetch enrollments: ${enrollmentsError.message}`);
  }

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
            // Validate course data
            if (!course || typeof course !== 'object' || !course.id || !course.title || !course.level) {
              return null;
            }
            
            const courseId = String(course.id);
            const title = String(course.title);
            const level = String(course.level);
            const description = typeof course.description === 'string' ? course.description : '';
            const imageUrl = typeof course.image_url === 'string' ? course.image_url : '';
            const progress = typeof course.progress === 'number' ? course.progress : (enrolledMap.get(courseId) || 0);
            const isEnrolled = enrolledMap.has(courseId);
            
            return (
              <Link
                key={courseId}
                href={`/courses/${courseId}`}
                className="bg-white/5 border border-white/10 rounded-xl overflow-hidden hover:bg-white/10 transition-colors group"
              >
                {imageUrl && (
                  <div className="h-36 bg-white/5 overflow-hidden">
                    <img
                      src={imageUrl}
                      alt={title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform"
                    />
                  </div>
                )}
                <div className="p-4">
                  <div className="flex items-center justify-between mb-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      levelColors[level] || 'bg-slate-500/20 text-slate-400'
                    }`}>
                      {level}
                    </span>
                    {isEnrolled && (
                      <span className="text-xs text-green-400">Enrolled</span>
                    )}
                  </div>
                  <h3 className="text-white font-semibold mt-1 group-hover:text-blue-300 transition-colors">
                    {title}
                  </h3>
                  <p className="text-slate-500 text-sm mt-1 line-clamp-2">
                    {description}
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
