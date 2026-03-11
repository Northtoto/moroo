import { redirect } from 'next/navigation';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { getPendingProfiles, getApprovedProfiles, getRejectedProfiles } from '../actions';
import ApprovalsClient from './ApprovalsClient';

// ─── Server component: verify admin + load data ───────────────────────────

export default async function AdminApprovalsPage() {
  const cookieStore = await cookies();

  const userClient = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        },
      },
    }
  );

  const {
    data: { user },
  } = await userClient.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  const { data: adminProfile } = await userClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (!adminProfile?.is_admin) {
    redirect('/');
  }

  // Load all three lists in parallel using the service-role-backed actions
  const [pending, approved, rejected] = await Promise.all([
    getPendingProfiles(),
    getApprovedProfiles(),
    getRejectedProfiles(),
  ]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-6">
      <div className="max-w-5xl mx-auto">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-1">Access Approvals</h1>
          <p className="text-slate-400 text-sm">
            Manage Skool member access to the platform
          </p>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-3 gap-4 mb-8">
          <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-yellow-400">{pending.length}</p>
            <p className="text-sm text-yellow-300/70 mt-1">Pending</p>
          </div>
          <div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-green-400">{approved.length}</p>
            <p className="text-sm text-green-300/70 mt-1">Approved</p>
          </div>
          <div className="bg-red-500/10 border border-red-500/20 rounded-xl p-4 text-center">
            <p className="text-3xl font-bold text-red-400">{rejected.length}</p>
            <p className="text-sm text-red-300/70 mt-1">Rejected</p>
          </div>
        </div>

        {/* Client component handles all interactivity */}
        <ApprovalsClient
          initialPending={pending}
          initialApproved={approved}
          initialRejected={rejected}
        />
      </div>
    </div>
  );
}
