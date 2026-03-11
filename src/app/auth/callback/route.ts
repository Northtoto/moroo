import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');

  if (!code) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);

  if (error) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Get the authenticated user
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`);
  }

  // Check approval status to determine where to send the user
  const { data: profile } = await supabase
    .from('profiles')
    .select('approval_status')
    .eq('id', user.id)
    .single();

  if (profile?.approval_status === 'approved') {
    return NextResponse.redirect(`${origin}/dashboard`);
  }

  if (profile?.approval_status === 'rejected') {
    return NextResponse.redirect(`${origin}/access-denied?reason=rejected`);
  }

  // Default: pending (or profile not found) → show waiting page
  return NextResponse.redirect(`${origin}/approval-pending`);
}
