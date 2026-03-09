import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import EnrollButton from './EnrollButton';

export default async function CourseDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  const { data: course } = await supabase
    .from('courses')
    .select('*')
    .eq('id', id)
    .eq('is_published', true)
    .single();

  if (!course) notFound();

  const { data: lessons } = await supabase
    .from('lessons')
    .select('*')
    .eq('course_id', id)
    .order('order_index', { ascending: true });

  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('*')
    .eq('user_id', user!.id)
    .eq('course_id', id)
    .single();

  const levelColors: Record<string, string> = {
    A1: 'bg-green-500/20 text-green-400',
    A2: 'bg-emerald-500/20 text-emerald-400',
    B1: 'bg-blue-500/20 text-blue-400',
    B2: 'bg-indigo-500/20 text-indigo-400',
    C1: 'bg-purple-500/20 text-purple-400',
    C2: 'bg-pink-500/20 text-pink-400',
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <Link
        href="/courses"
        className="inline-flex items-center gap-1 text-slate-400 hover:text-white text-sm transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to courses
      </Link>

      {/* Course header */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6">
        <div className="flex items-start justify-between">
          <div>
            <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${
              levelColors[course.level] || 'bg-slate-500/20 text-slate-400'
            }`}>
              {course.level}
            </span>
            <h1 className="text-2xl font-bold text-white mt-2">{course.title}</h1>
            <p className="text-slate-400 mt-2">{course.description}</p>
          </div>
        </div>

        {enrollment ? (
          <div className="mt-4">
            <div className="flex items-center justify-between text-sm mb-1">
              <span className="text-slate-400">Progress</span>
              <span className="text-white font-medium">{enrollment.progress}%</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2">
              <div
                className="bg-blue-500 h-2 rounded-full transition-all"
                style={{ width: `${enrollment.progress}%` }}
              />
            </div>
          </div>
        ) : (
          <EnrollButton courseId={id} />
        )}
      </div>

      {/* Lessons */}
      <div>
        <h2 className="text-lg font-semibold text-white mb-4">
          Lessons ({lessons?.length || 0})
        </h2>
        {lessons && lessons.length > 0 ? (
          <div className="space-y-2">
            {lessons.map((lesson: Record<string, unknown>, index: number) => (
              <div
                key={lesson.id as string}
                className="bg-white/5 border border-white/10 rounded-xl p-4 hover:bg-white/10 transition-colors"
              >
                <div className="flex items-center gap-4">
                  <span className="text-slate-500 font-mono text-sm w-8">
                    {String(index + 1).padStart(2, '0')}
                  </span>
                  <div className="flex-1">
                    <h3 className="text-white font-medium">{lesson.title as string}</h3>
                    {lesson.content && typeof lesson.content === 'object' && (lesson.content as Record<string, string>).summary ? (
                      <p className="text-slate-500 text-sm mt-1">
                        {(lesson.content as Record<string, string>).summary}
                      </p>
                    ) : null}
                  </div>
                  {enrollment && (
                    <svg className="w-5 h-5 text-slate-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                    </svg>
                  )}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-slate-500 text-sm">No lessons available yet.</p>
        )}
      </div>
    </div>
  );
}
