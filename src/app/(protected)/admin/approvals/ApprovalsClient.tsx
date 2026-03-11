'use client';

import { useState, useTransition } from 'react';
import { approveUser, rejectUser, revokeUser } from '../actions';

// ─── Types ────────────────────────────────────────────────────────────────────

interface PendingProfile {
  id: string;
  email: string;
  full_name: string | null;
  created_at: string;
  signup_source: string;
}

interface ApprovedProfile {
  id: string;
  email: string;
  full_name: string | null;
  approved_at: string | null;
  created_at: string;
}

interface RejectedProfile {
  id: string;
  email: string;
  full_name: string | null;
  rejection_reason: string | null;
  created_at: string;
}

interface Props {
  initialPending: PendingProfile[];
  initialApproved: ApprovedProfile[];
  initialRejected: RejectedProfile[];
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string | null) {
  if (!iso) return '—';
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

// ─── Pending Row ─────────────────────────────────────────────────────────────

function PendingRow({
  profile,
  onApprove,
  onReject,
}: {
  profile: PendingProfile;
  onApprove: (id: string) => void;
  onReject: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 hover:bg-white/8 transition-colors gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-white font-medium truncate">
          {profile.full_name || <span className="text-slate-500 italic">No name</span>}
        </p>
        <p className="text-slate-400 text-sm truncate">{profile.email}</p>
        <p className="text-slate-500 text-xs mt-0.5">
          Signed up {formatDate(profile.created_at)}
        </p>
      </div>
      <div className="flex gap-2 flex-shrink-0">
        <button
          onClick={() => onApprove(profile.id)}
          className="px-4 py-2 bg-green-600 hover:bg-green-700 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          Approve
        </button>
        <button
          onClick={() => onReject(profile.id)}
          className="px-4 py-2 bg-white/5 hover:bg-red-500/20 text-slate-300 hover:text-red-300 text-sm font-semibold rounded-lg border border-white/10 hover:border-red-500/30 transition-colors"
        >
          Reject
        </button>
      </div>
    </div>
  );
}

// ─── Approved Row ─────────────────────────────────────────────────────────────

function ApprovedRow({
  profile,
  onRevoke,
}: {
  profile: ApprovedProfile;
  onRevoke: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-white font-medium truncate">
          {profile.full_name || <span className="text-slate-500 italic">No name</span>}
        </p>
        <p className="text-slate-400 text-sm truncate">{profile.email}</p>
        <p className="text-slate-500 text-xs mt-0.5">
          Approved {formatDate(profile.approved_at)}
        </p>
      </div>
      <button
        onClick={() => onRevoke(profile.id)}
        className="px-3 py-1.5 text-xs bg-white/5 hover:bg-red-500/10 text-slate-400 hover:text-red-400 rounded-lg border border-white/10 hover:border-red-500/20 transition-colors flex-shrink-0"
      >
        Revoke
      </button>
    </div>
  );
}

// ─── Rejected Row ─────────────────────────────────────────────────────────────

function RejectedRow({
  profile,
  onApprove,
}: {
  profile: RejectedProfile;
  onApprove: (id: string) => void;
}) {
  return (
    <div className="flex items-center justify-between p-4 rounded-xl bg-white/5 border border-white/10 gap-4">
      <div className="min-w-0 flex-1">
        <p className="text-white font-medium truncate">
          {profile.full_name || <span className="text-slate-500 italic">No name</span>}
        </p>
        <p className="text-slate-400 text-sm truncate">{profile.email}</p>
        {profile.rejection_reason && (
          <p className="text-red-400/70 text-xs mt-0.5 truncate">
            Reason: {profile.rejection_reason}
          </p>
        )}
      </div>
      <button
        onClick={() => onApprove(profile.id)}
        className="px-3 py-1.5 text-xs bg-green-500/10 hover:bg-green-500/20 text-green-400 rounded-lg border border-green-500/20 transition-colors flex-shrink-0"
      >
        Re-approve
      </button>
    </div>
  );
}

// ─── Main Client Component ────────────────────────────────────────────────────

export default function ApprovalsClient({
  initialPending,
  initialApproved,
  initialRejected,
}: Props) {
  const [tab, setTab] = useState<'pending' | 'approved' | 'rejected'>('pending');
  const [pending, setPending] = useState(initialPending);
  const [approved, setApproved] = useState(initialApproved);
  const [rejected, setRejected] = useState(initialRejected);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // ── Approve ────────────────────────────────────────────────────────────────
  function handleApprove(profileId: string) {
    const profile =
      pending.find((p) => p.id === profileId) ||
      rejected.find((p) => p.id === profileId);

    startTransition(async () => {
      try {
        await approveUser(profileId);
        setError(null);
        // Optimistic UI: move to approved list
        setPending((prev) => prev.filter((p) => p.id !== profileId));
        setRejected((prev) => prev.filter((p) => p.id !== profileId));
        if (profile) {
          setApproved((prev) => [
            {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              approved_at: new Date().toISOString(),
              created_at: profile.created_at,
            },
            ...prev,
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to approve user');
      }
    });
  }

  // ── Reject ─────────────────────────────────────────────────────────────────
  function handleReject(profileId: string) {
    const reason = window.prompt(
      'Rejection reason (optional — shown to admin only):'
    );
    if (reason === null) return; // user cancelled

    const profile = pending.find((p) => p.id === profileId);

    startTransition(async () => {
      try {
        await rejectUser(profileId, reason);
        setError(null);
        // Optimistic UI: move to rejected list
        setPending((prev) => prev.filter((p) => p.id !== profileId));
        if (profile) {
          setRejected((prev) => [
            {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              rejection_reason: reason || 'No reason provided',
              created_at: profile.created_at,
            },
            ...prev,
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to reject user');
      }
    });
  }

  // ── Revoke ─────────────────────────────────────────────────────────────────
  function handleRevoke(profileId: string) {
    if (!window.confirm('Revoke access for this user? They will need re-approval.')) return;

    const profile = approved.find((p) => p.id === profileId);

    startTransition(async () => {
      try {
        await revokeUser(profileId);
        setError(null);
        // Optimistic UI: move back to pending
        setApproved((prev) => prev.filter((p) => p.id !== profileId));
        if (profile) {
          setPending((prev) => [
            {
              id: profile.id,
              email: profile.email,
              full_name: profile.full_name,
              created_at: profile.created_at,
              signup_source: 'web',
            },
            ...prev,
          ]);
        }
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to revoke access');
      }
    });
  }

  const tabs = [
    { key: 'pending' as const, label: 'Pending', count: pending.length, color: 'text-yellow-400' },
    { key: 'approved' as const, label: 'Approved', count: approved.length, color: 'text-green-400' },
    { key: 'rejected' as const, label: 'Rejected', count: rejected.length, color: 'text-red-400' },
  ];

  return (
    <div className="bg-white/5 backdrop-blur-lg rounded-2xl border border-white/10 overflow-hidden">
      {/* Error banner */}
      {error && (
        <div className="bg-red-500/20 border-b border-red-500/30 px-6 py-3 flex items-center justify-between">
          <p className="text-red-300 text-sm">{error}</p>
          <button
            onClick={() => setError(null)}
            className="text-red-400 hover:text-red-300 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Loading overlay */}
      {isPending && (
        <div className="bg-blue-500/10 border-b border-blue-500/20 px-6 py-2">
          <p className="text-blue-300 text-xs">Saving…</p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-white/10">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex-1 py-4 px-4 text-sm font-medium transition-colors flex items-center justify-center gap-2 ${
              tab === t.key
                ? 'bg-white/5 text-white border-b-2 border-blue-500'
                : 'text-slate-400 hover:text-slate-300'
            }`}
          >
            {t.label}
            <span
              className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                tab === t.key ? `bg-white/10 ${t.color}` : 'bg-white/5 text-slate-500'
              }`}
            >
              {t.count}
            </span>
          </button>
        ))}
      </div>

      {/* Content */}
      <div className="p-6">
        {/* ── Pending ─────────────────────────────────────────────────────── */}
        {tab === 'pending' && (
          <div>
            {pending.length === 0 ? (
              <EmptyState
                icon="✅"
                title="No pending approvals"
                subtitle="All signups have been reviewed."
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-4">
                  {pending.length} user{pending.length !== 1 ? 's' : ''} awaiting review
                </p>
                {pending.map((profile) => (
                  <PendingRow
                    key={profile.id}
                    profile={profile}
                    onApprove={handleApprove}
                    onReject={handleReject}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Approved ─────────────────────────────────────────────────────── */}
        {tab === 'approved' && (
          <div>
            {approved.length === 0 ? (
              <EmptyState
                icon="👥"
                title="No approved users yet"
                subtitle="Approved users will appear here."
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-4">
                  {approved.length} approved user{approved.length !== 1 ? 's' : ''}
                </p>
                {approved.map((profile) => (
                  <ApprovedRow
                    key={profile.id}
                    profile={profile}
                    onRevoke={handleRevoke}
                  />
                ))}
              </div>
            )}
          </div>
        )}

        {/* ── Rejected ─────────────────────────────────────────────────────── */}
        {tab === 'rejected' && (
          <div>
            {rejected.length === 0 ? (
              <EmptyState
                icon="📋"
                title="No rejected users"
                subtitle="Rejected users will appear here."
              />
            ) : (
              <div className="space-y-3">
                <p className="text-xs text-slate-500 mb-4">
                  {rejected.length} rejected user{rejected.length !== 1 ? 's' : ''}
                </p>
                {rejected.map((profile) => (
                  <RejectedRow
                    key={profile.id}
                    profile={profile}
                    onApprove={handleApprove}
                  />
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function EmptyState({
  icon,
  title,
  subtitle,
}: {
  icon: string;
  title: string;
  subtitle: string;
}) {
  return (
    <div className="text-center py-12">
      <div className="text-4xl mb-3">{icon}</div>
      <p className="text-white font-medium mb-1">{title}</p>
      <p className="text-slate-500 text-sm">{subtitle}</p>
    </div>
  );
}
