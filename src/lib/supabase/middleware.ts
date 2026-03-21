import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { SECURITY_HEADERS } from '@/lib/security';

// Static references required — Next.js inlines NEXT_PUBLIC_* at build time
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export async function updateSession(request: NextRequest) {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }

  let supabaseResponse = NextResponse.next({ request });

  // ─── Apply security headers to every response ────────────────────────────
  for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
    supabaseResponse.headers.set(key, value);
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseAnonKey,
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
          // Re-apply security headers after response recreation
          for (const [key, value] of Object.entries(SECURITY_HEADERS)) {
            supabaseResponse.headers.set(key, value);
          }
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, {
              ...options,
              // 2026 hardening: enforce secure cookie attributes
              httpOnly: true,
              secure: process.env.NODE_ENV === 'production',
              sameSite: 'lax',
            })
          );
        },
      },
    }
  );

  // Use getUser() instead of getSession() — validates JWT server-side
  // getSession() only decodes the JWT without verification (insecure)
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const pathname = request.nextUrl.pathname;

  // ─── Block suspicious request patterns ────────────────────────────────────
  const suspiciousPatterns = [
    /\.\.\//,            // Path traversal
    /<script/i,          // XSS attempt
    /union\s+select/i,   // SQL injection
    /%00/,               // Null byte injection
    /\/etc\/passwd/,     // File inclusion
    /\/proc\/self/,      // Linux proc access
  ];

  for (const pattern of suspiciousPatterns) {
    if (pattern.test(pathname) || pattern.test(request.nextUrl.search)) {
      return new NextResponse('Forbidden', { status: 403 });
    }
  }

  // ─── 1. Admin route protection (/admin/*) ─────────────────────────────────
  if (pathname.startsWith('/admin')) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_admin, locked_until')
      .eq('id', user.id)
      .single();

    // Check account lock
    if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'account_locked');
      return NextResponse.redirect(url);
    }

    if (!profile?.is_admin) {
      const url = request.nextUrl.clone();
      url.pathname = '/';
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ─── 2. Protected routes ─────────────────────────────────────────────────
  const protectedPaths = ['/dashboard', '/courses', '/tutor', '/league', '/profile', '/progress', '/certificate', '/flashcards', '/lesen'];
  const isCourseRoute = protectedPaths.some(path => pathname.startsWith(path));

  if (isCourseRoute) {
    if (!user) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      return NextResponse.redirect(url);
    }

    const { data: profile } = await supabase
      .from('profiles')
      .select('approval_status, locked_until')
      .eq('id', user.id)
      .single();

    // Check account lock
    if (profile?.locked_until && new Date(profile.locked_until) > new Date()) {
      const url = request.nextUrl.clone();
      url.pathname = '/login';
      url.searchParams.set('error', 'account_locked');
      return NextResponse.redirect(url);
    }

    if (!profile) {
      const url = request.nextUrl.clone();
      url.pathname = '/approval-pending';
      return NextResponse.redirect(url);
    }

    // Auto-approve mode: 'pending' users pass through (migration 021 sets default to 'approved')
    // Only explicitly rejected accounts are blocked.
    if (profile.approval_status === 'rejected') {
      const url = request.nextUrl.clone();
      url.pathname = '/access-denied';
      url.searchParams.set('reason', 'rejected');
      return NextResponse.redirect(url);
    }

    return supabaseResponse;
  }

  // ─── 3. Auth page redirect ────────────────────────────────────────────────
  // Skip redirect if ?switch=1 — lets authenticated users explicitly switch accounts.
  const wantsSwitch = request.nextUrl.searchParams.get('switch') === '1';
  if (user && !wantsSwitch && (pathname === '/login' || pathname === '/signup')) {
    const url = request.nextUrl.clone();
    url.pathname = '/dashboard';
    return NextResponse.redirect(url);
  }

  return supabaseResponse;
}
