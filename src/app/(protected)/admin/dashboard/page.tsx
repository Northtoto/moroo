import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { createServerClient } from '@supabase/ssr';
import { redirect } from 'next/navigation';

async function verifyAdmin() {
  const cookieStore = await cookies();
  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() { return cookieStore.getAll(); },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options));
        },
      },
    }
  );
  const { data: { user } } = await userClient.auth.getUser();
  if (!user) redirect('/login');

  const { data: profile } = await userClient.from('profiles').select('is_admin').eq('id', user.id).single();
  if (!profile?.is_admin) redirect('/dashboard');

  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } }
  );
}

export default async function AdminDashboardPage() {
  const admin = await verifyAdmin();

  // Parallel queries for platform stats
  const [
    { count: totalUsers },
    { count: pendingUsers },
    { count: approvedUsers },
    { count: totalCorrections },
    { count: correctionsToday },
    { count: totalCourses },
    { count: totalEnrollments },
    { data: topUsers },
    { data: recentSignups },
  ] = await Promise.all([
    admin.from('profiles').select('*', { count: 'exact', head: true }),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'pending'),
    admin.from('profiles').select('*', { count: 'exact', head: true }).eq('approval_status', 'approved'),
    admin.from('messages').select('*', { count: 'exact', head: true }),
    admin.from('messages').select('*', { count: 'exact', head: true })
      .gte('created_at', new Date(new Date().setHours(0, 0, 0, 0)).toISOString()),
    admin.from('courses').select('*', { count: 'exact', head: true }).eq('is_published', true),
    admin.from('enrollments').select('*', { count: 'exact', head: true }),
    admin.from('messages')
      .select('user_id, profiles!inner(email, full_name)')
      .limit(100)
      .then(({ data }) => {
        if (!data) return { data: [] };
        const counts: Record<string, { email: string; name: string; count: number }> = {};
        data.forEach((m: Record<string, unknown>) => {
          const uid = String(m.user_id);
          const profile = m.profiles as { email: string; full_name: string } | null;
          if (!counts[uid]) counts[uid] = { email: profile?.email ?? uid, name: profile?.full_name ?? '', count: 0 };
          counts[uid].count++;
        });
        return { data: Object.values(counts).sort((a, b) => b.count - a.count).slice(0, 5) };
      }),
    admin.from('profiles')
      .select('email, full_name, created_at, approval_status')
      .order('created_at', { ascending: false })
      .limit(5),
  ]);

  const stats = [
    { label: 'Total users', value: totalUsers ?? 0, color: 'text-blue-400' },
    { label: 'Pending approval', value: pendingUsers ?? 0, color: 'text-amber-400' },
    { label: 'Active students', value: approvedUsers ?? 0, color: 'text-emerald-400' },
    { label: 'Total corrections', value: totalCorrections ?? 0, color: 'text-purple-400' },
    { label: 'Corrections today', value: correctionsToday ?? 0, color: 'text-pink-400' },
    { label: 'Published courses', value: totalCourses ?? 0, color: 'text-cyan-400' },
    { label: 'Enrollments', value: totalEnrollments ?? 0, color: 'text-indigo-400' },
  ];

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-white">Admin Dashboard</h1>
          <p className="text-slate-400 mt-1">Platform overview and stats.</p>
        </div>
        <a
          href="/admin/approvals"
          className="text-sm text-blue-400 hover:underline"
        >
          Manage approvals →
        </a>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {stats.map(({ label, value, color }) => (
          <div key={label} className="bg-white/5 border border-white/10 rounded-xl p-4">
            <div className={`text-2xl font-bold ${color}`}>{value.toLocaleString()}</div>
            <div className="text-slate-500 text-xs mt-1">{label}</div>
          </div>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Most active users */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Most Active Students</h2>
          {topUsers && topUsers.length > 0 ? (
            <div className="space-y-3">
              {topUsers.map((u: { email: string; name: string; count: number }, i) => (
                <div key={u.email} className="flex items-center gap-3">
                  <span className="text-slate-600 font-mono text-sm w-5">{i + 1}.</span>
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{u.name || u.email}</p>
                    {u.name && <p className="text-slate-500 text-xs truncate">{u.email}</p>}
                  </div>
                  <span className="text-blue-400 text-sm font-medium shrink-0">{u.count} corrections</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No data yet.</p>
          )}
        </div>

        {/* Recent signups */}
        <div className="bg-white/5 border border-white/10 rounded-xl p-5">
          <h2 className="text-white font-semibold mb-4">Recent Signups</h2>
          {recentSignups && recentSignups.length > 0 ? (
            <div className="space-y-3">
              {recentSignups.map((u: Record<string, string>) => (
                <div key={u.email} className="flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <p className="text-white text-sm truncate">{u.full_name || u.email}</p>
                    <p className="text-slate-500 text-xs">{new Date(u.created_at).toLocaleDateString()}</p>
                  </div>
                  <span className={`text-xs px-2 py-0.5 rounded-full ${
                    u.approval_status === 'approved' ? 'bg-emerald-500/20 text-emerald-400'
                    : u.approval_status === 'rejected' ? 'bg-red-500/20 text-red-400'
                    : 'bg-amber-500/20 text-amber-400'
                  }`}>
                    {u.approval_status}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-sm">No recent signups.</p>
          )}
        </div>
      </div>
    </div>
  );
}
