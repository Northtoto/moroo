import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

function getEnvVar(key: string): string {
  const value = process.env[key];
  if (!value) {
    throw new Error(`Missing environment variable: ${key}`);
  }
  return value;
}

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request });

  const supabase = createServerClient(
    getEnvVar('NEXT_PUBLIC_SUPABASE_URL'),
    getEnvVar('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          supabaseResponse = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ─── 1. Admin route protection (/admin/*) ──────────────────────────────────
  // Requires: authenticated + is_admin = true
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin')
      .eq('id', user.id)
      .single();

    if (!profile?.is_admin) {
      // Not an admin — redirect to home, not an error page
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    // is_admin = true → allow admin access
    return supabaseResponse;
  }

  // ─── 2. Course route protection (/dashboard, /courses, /tutor) ───────────
  // Requires: authenticated + approval_status = 'approved'
  const coursePaths = ['/dashboard', '/courses', '/tutor', '/history', '/profile'];
  const isCourseRoute = coursePaths.some(path => pathname.startsWith(path));

  if (isCourseRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status')
      .eq('id', user.id)
      .single();

    // Profile missing (edge case: trigger hasn't run yet)
    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = '/approval-pending';
      return NextResponse.redirect(url);
    }

    if (profile.approval_status === 'pending') {
      const url = request.nextUrl.clone();
      url.pathname = '/approval-pending';
      return NextResponse.redirect(url);
    }

    if (profile.approval_status === 'rejected') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      url.searchParams.set('reason', 'rejected');
      return NextResponse.redirect(url);
    }

    // approval_status = 'approved' → allow course access
    return supabaseResponse;
  }

  // ─── 3. Auth page redirect ─────────────────────────────────────────────────
  // Authenticated users visiting /login or /signup → send to dashboard
  if (
    user &&
    (pathname === '/login' || pathname === '/signup')
  ) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
