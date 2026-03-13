import { createClient } from '@/lib/supabase/server';
import ProfileForm from './ProfileForm';

export default async function ProfilePage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user?.id) throw new Error('User not authenticated');

  const { data: profile, error } = await supabase
    .from('profiles')
    .select('full_name, email, subscription_tier, current_streak, longest_streak, german_level, learning_goal, created_at')
    .eq('id', user.id)
    .single();

  if (error) throw new Error(`Failed to fetch profile: ${error.message}`);

  // Fetch stats
  const { count: totalCorrections } = await supabase
    .from('messages')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: totalLessons } = await supabase
    .from('lesson_completions')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const { count: totalCourses } = await supabase
    .from('enrollments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id);

  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
    : '—';

  return (
    <div className="max-w-2xl mx-auto space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-white">Profile & Settings</h1>
        <p className="text-slate-400 mt-1">Manage your account and learning preferences.</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Corrections', value: totalCorrections ?? 0 },
          { label: 'Lessons done', value: totalLessons ?? 0 },
          { label: 'Courses', value: totalCourses ?? 0 },
          { label: 'Day streak', value: profile?.current_streak ?? 0 },
        ].map(({ label, value }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4 text-center">
            <div className="text-2xl font-bold text-white">{value}</div>
            <div className="text-slate-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      {/* Account info */}
      <div className="bg-white/5 border border-white/10 rounded-xl p-6 space-y-4">
        <h2 className="text-white font-semibold">Account</h2>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Email</span>
          <span className="text-white">{profile?.email ?? user.email}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Member since</span>
          <span className="text-white">{memberSince}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-slate-400">Plan</span>
          <span className={`capitalize px-2 py-0.5 rounded-full text-xs font-medium ${
            profile?.subscription_tier === 'premium'
              ? 'bg-amber-500/20 text-amber-400'
              : 'bg-slate-500/20 text-slate-400'
          }`}>
            {profile?.subscription_tier ?? 'free'}
          </span>
        </div>
        {(profile?.longest_streak ?? 0) > 0 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-slate-400">Longest streak</span>
            <span className="text-white">{profile?.longest_streak} days</span>
          </div>
        )}
      </div>

      {/* Editable fields */}
      <ProfileForm
        userId={user.id}
        initialName={profile?.full_name ?? ''}
        initialLevel={profile?.german_level ?? ''}
        initialGoal={profile?.learning_goal ?? ''}
      />
    </div>
  );
}
