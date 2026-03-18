import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import ProtectedNav from '@/components/layout/ProtectedNav';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch profile + XP data in parallel
  const [profileResult, xpResult] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url').eq('id', user.id).single(),
    supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single(),
  ]);

  const profile = profileResult.data;
  const xpData = xpResult.data ?? { total_xp: 0, level: 'A1' };

  // Fetch streak
  const { data: streakData } = await supabase
    .from('streaks')
    .select('current_streak')
    .eq('user_id', user.id)
    .single();

  const streak = streakData?.current_streak ?? 0;

  const displayName =
    profile?.full_name ?? user.email?.split('@')[0] ?? 'Lernender';

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg-base)' }}>
      <ProtectedNav
        displayName={displayName}
        email={user.email ?? ''}
        avatarUrl={profile?.avatar_url ?? null}
        totalXp={xpData.total_xp}
        level={xpData.level as string}
        streak={streak}
      />

      {/* Main content area */}
      <main className="flex-1 flex flex-col min-h-screen overflow-hidden">
        {children}
      </main>
    </div>
  );
}
