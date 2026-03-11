'use server';

import { createServerClient } from '@supabase/ssr';
import { createClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { revalidatePath } from 'next/cache';

// ─── Helper: Verify caller is an authenticated admin ────────────────────────

async function verifyAdmin() {
  const cookieStore = await cookies();

  // Step 1: User-scoped client — identifies who is making the request
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
    throw new Error('Unauthorized: not authenticated');
  }

  // Step 2: Verify is_admin via user-scoped client (respects RLS — user can read own row)
  const { data: profile, error } = await userClient
    .from('profiles')
    .select('is_admin')
    .eq('id', user.id)
    .single();

  if (error || !profile?.is_admin) {
    throw new Error('Unauthorized: user is not an admin');
  }

  return user;
}

// ─── Admin Supabase client (service-role, bypasses RLS) ─────────────────────

function getAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !serviceKey) {
    throw new Error(
      'Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY'
    );
  }

  return createClient(url, serviceKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

// ─── Server Actions ──────────────────────────────────────────────────────────

export async function approveUser(profileId: string): Promise<{ success: true }> {
  // Always re-verify on every action (no implicit carry-over from page load)
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from('profiles')
    .update({
      approval_status: 'approved',
      approved_at: new Date().toISOString(),
      rejection_reason: null,
    })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to approve user: ${error.message}`);
  }

  revalidatePath('/admin/approvals');
  return { success: true };
}

export async function rejectUser(
  profileId: string,
  reason: string
): Promise<{ success: true }> {
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from('profiles')
    .update({
      approval_status: 'rejected',
      rejection_reason: reason || 'No reason provided',
      approved_at: null,
    })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to reject user: ${error.message}`);
  }

  revalidatePath('/admin/approvals');
  return { success: true };
}

export async function revokeUser(profileId: string): Promise<{ success: true }> {
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { error } = await adminClient
    .from('profiles')
    .update({
      approval_status: 'pending',
      approved_at: null,
      rejection_reason: null,
    })
    .eq('id', profileId);

  if (error) {
    throw new Error(`Failed to revoke user access: ${error.message}`);
  }

  revalidatePath('/admin/approvals');
  return { success: true };
}

// ─── Data Loaders (called from server components) ────────────────────────────

export async function getPendingProfiles() {
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, full_name, created_at, signup_source')
    .eq('approval_status', 'pending')
    .order('created_at', { ascending: true });

  if (error) {
    throw new Error(`Failed to load pending profiles: ${error.message}`);
  }

  return data ?? [];
}

export async function getApprovedProfiles() {
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, full_name, approved_at, created_at')
    .eq('approval_status', 'approved')
    .order('approved_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load approved profiles: ${error.message}`);
  }

  return data ?? [];
}

export async function getRejectedProfiles() {
  await verifyAdmin();

  const adminClient = getAdminClient();

  const { data, error } = await adminClient
    .from('profiles')
    .select('id, email, full_name, rejection_reason, created_at')
    .eq('approval_status', 'rejected')
    .order('created_at', { ascending: false });

  if (error) {
    throw new Error(`Failed to load rejected profiles: ${error.message}`);
  }

  return data ?? [];
}
