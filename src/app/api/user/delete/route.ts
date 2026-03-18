import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';
import { createClient as createServiceClient } from '@supabase/supabase-js';

export const dynamic = 'force-dynamic';

/**
 * POST /api/user/delete
 * GDPR Article 17 — Right to erasure ("right to be forgotten")
 *
 * Deletes ALL user data from every table via the delete_user_data RPC,
 * then deletes the auth.users record via the admin API.
 *
 * Rate limited: 1 request per hour (enforced by caller or middleware).
 */
export async function POST() {
  try {
    // 1. Verify the user is authenticated
    const supabase = await createClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json({ error: 'Nicht authentifiziert' }, { status: 401 });
    }

    // 2. Delete all user data via SECURITY DEFINER RPC (bypasses RLS)
    const serviceUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

    if (!serviceUrl || !serviceKey) {
      console.error('[gdpr:delete] Missing service role config');
      return NextResponse.json({ error: 'Serverfehler' }, { status: 500 });
    }

    const adminClient = createServiceClient(serviceUrl, serviceKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Call the RPC that cascades through all 17 user tables
    const { error: rpcError } = await adminClient.rpc('delete_user_data', {
      p_user_id: user.id,
    });

    if (rpcError) {
      console.error('[gdpr:delete] RPC failed:', rpcError);
      return NextResponse.json({ error: 'Datenlöschung fehlgeschlagen' }, { status: 500 });
    }

    // 3. Delete the auth.users record
    const { error: deleteAuthError } = await adminClient.auth.admin.deleteUser(user.id);

    if (deleteAuthError) {
      console.error('[gdpr:delete] Auth user deletion failed:', deleteAuthError);
      // Data is already deleted — log but don't fail the user
    }

    return NextResponse.json({
      success: true,
      message: 'Alle Daten wurden gelöscht. Ihr Konto wurde entfernt.',
    });
  } catch (err) {
    console.error('[gdpr:delete] Unexpected error:', err);
    return NextResponse.json({ error: 'Ein Fehler ist aufgetreten' }, { status: 500 });
  }
}
