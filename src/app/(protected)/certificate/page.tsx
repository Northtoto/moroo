import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import CertificateView from '@/components/certificate/CertificateView';

// CEFR levels eligible for certificate (B2 and above = "good in German")
const ELIGIBLE_LEVELS = ['B2', 'C1', 'C2'];

const LEVEL_TITLES: Record<string, string> = {
  B2: 'Upper Intermediate',
  C1: 'Advanced',
  C2: 'Mastery',
};

const LEVEL_HONORS: Record<string, string> = {
  B2: 'Certificate of Achievement',
  C1: 'Certificate of Distinction',
  C2: 'Certificate of Mastery — Summa Cum Laude',
};

export default async function CertificatePage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect('/login');

  // Fetch profile, XP, correction stats, and streak in parallel.
  // correction_count lives in learning_state — there is no 'messages' table.
  const [profileResult, xpResult, learningResult, streakResult] = await Promise.all([
    supabase.from('profiles').select('full_name, avatar_url, created_at').eq('id', user.id).single(),
    supabase.from('user_xp').select('total_xp, level').eq('user_id', user.id).single(),
    supabase.from('learning_state').select('correction_count').eq('user_id', user.id).single(),
    supabase.from('streaks').select('current_streak, best_streak').eq('user_id', user.id).single(),
  ]);

  const profile = profileResult.data;
  const xpData = xpResult.data ?? { total_xp: 0, level: 'A1' };
  const totalCorrections = learningResult.data?.correction_count ?? 0;
  const streakData = streakResult.data ?? { current_streak: 0, best_streak: 0 };

  const currentLevel = xpData.level as string;
  const isEligible = ELIGIBLE_LEVELS.includes(currentLevel);

  const displayName = profile?.full_name ?? user.email?.split('@')[0] ?? 'Student';
  const memberSince = profile?.created_at
    ? new Date(profile.created_at).toLocaleDateString('en-US', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
      })
    : 'Unknown';

  // Calculate certificate date (today)
  const certificateDate = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });

  // Generate a unique certificate ID
  const certId = `MORO-${currentLevel}-${user.id.substring(0, 8).toUpperCase()}-${Date.now().toString(36).toUpperCase()}`;

  if (!isEligible) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="glass rounded-2xl p-8 max-w-lg text-center space-y-6">
          <div className="text-6xl">🎓</div>
          <h1 className="text-2xl font-bold text-white font-[family-name:var(--font-display)]">
            Certificate of Honors
          </h1>
          <p className="text-slate-400">
            Certificates are awarded to students who reach <strong className="text-amber-400">B2 level</strong> or higher.
          </p>

          <div className="glass-surface rounded-xl p-4 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Your current level</span>
              <span className="text-lg font-bold text-white">{currentLevel}</span>
            </div>
            <div className="flex items-center justify-between">
              <span className="text-slate-500 text-sm">Required level</span>
              <span className="text-lg font-bold text-amber-400">B2+</span>
            </div>
            <div className="w-full bg-white/10 rounded-full h-2 mt-2">
              {(() => {
                const levels = ['A1', 'A2', 'B1', 'B2', 'C1', 'C2'];
                const currentIdx = levels.indexOf(currentLevel);
                const targetIdx = levels.indexOf('B2');
                const progress = Math.min(((currentIdx + 1) / (targetIdx + 1)) * 100, 100);
                return (
                  <div
                    className="bg-gradient-to-r from-amber-500 to-amber-400 h-2 rounded-full transition-all"
                    style={{ width: `${progress}%` }}
                  />
                );
              })()}
            </div>
          </div>

          <p className="text-slate-500 text-sm">
            Keep practicing with the AI Tutor to level up! You&apos;re doing great. 💪
          </p>
        </div>
      </div>
    );
  }

  return (
    <CertificateView
      studentName={displayName}
      level={currentLevel}
      levelTitle={LEVEL_TITLES[currentLevel] ?? currentLevel}
      honorsTitle={LEVEL_HONORS[currentLevel] ?? 'Certificate of Achievement'}
      totalXp={xpData.total_xp}
      totalCorrections={totalCorrections}
      bestStreak={streakData.best_streak}
      memberSince={memberSince}
      certificateDate={certificateDate}
      certificateId={certId}
    />
  );
}
