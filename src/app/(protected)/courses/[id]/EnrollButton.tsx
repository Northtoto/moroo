'use client';

import { useState } from 'react';
import { createClient } from '@/lib/supabase/client';
import { useRouter } from 'next/navigation';

export default function EnrollButton({ courseId }: { courseId: string }) {
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const supabase = createClient();

  async function handleEnroll() {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    await supabase
      .from('enrollments')
      .insert({ user_id: user.id, course_id: courseId });

    router.refresh();
    setLoading(false);
  }

  return (
    <button
      onClick={handleEnroll}
      disabled={loading}
      className="mt-4 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 disabled:bg-blue-600/50 text-white font-semibold rounded-xl transition-colors text-sm"
    >
      {loading ? 'Enrolling...' : 'Enroll in Course'}
    </button>
  );
}
