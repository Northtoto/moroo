import { createClient } from '@/lib/supabase/server';
import { notFound } from 'next/navigation';
import Link from 'next/link';

interface LessonContent {
  summary?: string;
  body?: string;
  vocabulary?: { word: string; translation: string; example?: string }[];
  grammar_points?: string[];
  exercises?: { question: string; answer?: string }[];
}

export default async function LessonDetailPage({
  params,
}: {
  params: Promise<{ id: string; lessonId: string }>;
}) {
  const { id: courseId, lessonId } = await params;
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) throw new Error('User not authenticated');

  // Verify enrollment
  const { data: enrollment } = await supabase
    .from('enrollments')
    .select('id, progress')
    .eq('user_id', user.id)
    .eq('course_id', courseId)
    .single();

  if (!enrollment) {
    return (
      <div className="max-w-3xl mx-auto text-center py-16">
        <p className="text-slate-400 mb-4">You must enroll in this course to view lessons.</p>
        <Link href={`/courses/${courseId}`} className="text-blue-400 hover:underline">
          Go to course page
        </Link>
      </div>
    );
  }

  // Fetch current lesson
  const { data: lesson, error: lessonError } = await supabase
    .from('lessons')
    .select('*')
    .eq('id', lessonId)
    .eq('course_id', courseId)
    .single();

  if (lessonError || !lesson) notFound();

  // Fetch course for breadcrumb
  const { data: course } = await supabase
    .from('courses')
    .select('title, id')
    .eq('id', courseId)
    .single();

  // Fetch all lessons to build prev/next
  const { data: allLessons } = await supabase
    .from('lessons')
    .select('id, title, order_index')
    .eq('course_id', courseId)
    .order('order_index', { ascending: true });

  const currentIndex = allLessons?.findIndex((l) => l.id === lessonId) ?? -1;
  const prevLesson = currentIndex > 0 ? allLessons?.[currentIndex - 1] : null;
  const nextLesson = allLessons && currentIndex < allLessons.length - 1 ? allLessons[currentIndex + 1] : null;

  const content = (lesson.content as LessonContent) ?? {};
  const title = String(lesson.title ?? 'Lesson');

  return (
    <div className="max-w-3xl mx-auto space-y-8">
      {/* Breadcrumb */}
      <nav className="flex items-center gap-2 text-sm text-slate-500">
        <Link href="/courses" className="hover:text-white transition-colors">Courses</Link>
        <span>/</span>
        <Link href={`/courses/${courseId}`} className="hover:text-white transition-colors">
          {course?.title ?? 'Course'}
        </Link>
        <span>/</span>
        <span className="text-slate-300">{title}</span>
      </nav>

      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">{title}</h1>
        {content.summary && (
          <p className="text-slate-400 mt-2">{content.summary}</p>
        )}
      </div>

      {/* Body */}
      {content.body && (
        <div className="bg-white/5 border border-white/10 rounded-xl p-6">
          <div className="prose prose-invert prose-sm max-w-none text-slate-300 whitespace-pre-wrap leading-relaxed">
            {content.body}
          </div>
        </div>
      )}

      {/* Vocabulary */}
      {content.vocabulary && content.vocabulary.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Vocabulary</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {content.vocabulary.map((item, i) => (
              <div key={i} className="bg-white/5 border border-white/10 rounded-xl p-4">
                <div className="flex items-center justify-between mb-1">
                  <span className="text-white font-medium">{item.word}</span>
                  <span className="text-blue-400 text-sm">{item.translation}</span>
                </div>
                {item.example && (
                  <p className="text-slate-500 text-xs italic">{item.example}</p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Grammar points */}
      {content.grammar_points && content.grammar_points.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Grammar Points</h2>
          <ul className="space-y-2">
            {content.grammar_points.map((point, i) => (
              <li key={i} className="flex gap-3 bg-white/5 border border-white/10 rounded-xl p-4">
                <span className="text-blue-400 font-bold shrink-0">{i + 1}.</span>
                <span className="text-slate-300 text-sm">{point}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Exercises */}
      {content.exercises && content.exercises.length > 0 && (
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Exercises</h2>
          <div className="space-y-4">
            {content.exercises.map((ex, i) => (
              <details key={i} className="bg-white/5 border border-white/10 rounded-xl p-4 group">
                <summary className="text-slate-300 text-sm cursor-pointer list-none flex items-center justify-between">
                  <span><span className="text-blue-400 font-medium mr-2">{i + 1}.</span>{ex.question}</span>
                  <svg className="w-4 h-4 text-slate-500 group-open:rotate-180 transition-transform" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                {ex.answer && (
                  <div className="mt-3 pt-3 border-t border-white/10">
                    <p className="text-green-400 text-sm">{ex.answer}</p>
                  </div>
                )}
              </details>
            ))}
          </div>
        </div>
      )}

      {/* Empty content fallback */}
      {!content.body && !content.vocabulary?.length && !content.grammar_points?.length && (
        <div className="text-center py-10 text-slate-500 text-sm">
          This lesson content is coming soon.
        </div>
      )}

      {/* Prev / Next navigation */}
      <div className="flex items-center justify-between pt-4 border-t border-white/10">
        {prevLesson ? (
          <Link
            href={`/courses/${courseId}/lessons/${prevLesson.id}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            {prevLesson.title}
          </Link>
        ) : <div />}

        {nextLesson ? (
          <Link
            href={`/courses/${courseId}/lessons/${nextLesson.id}`}
            className="flex items-center gap-2 text-slate-400 hover:text-white text-sm transition-colors"
          >
            {nextLesson.title}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </Link>
        ) : (
          <Link
            href={`/courses/${courseId}`}
            className="flex items-center gap-2 text-emerald-400 hover:text-emerald-300 text-sm transition-colors font-medium"
          >
            Course complete!
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </Link>
        )}
      </div>
    </div>
  );
}
