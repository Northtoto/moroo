// ─── Next.js Middleware Entry Point ──────────────────────────────────────────
// Activates the Supabase session + security middleware on every request.
// The full implementation lives in src/lib/supabase/middleware.ts:
//   - JWT validation via getUser() (not getSession — server-side verified)
//   - Security headers (CSP, HSTS, X-Frame-Options, etc.)
//   - Path traversal / XSS / SQLi request blocking
//   - /admin/* route protection (is_admin check)
//   - Protected routes guard → redirects to /login if no session
//   - approval_status / account lock enforcement
//   - Redirect logged-in users away from /login and /signup

import { type NextRequest } from 'next/server';
import { updateSession } from '@/lib/supabase/middleware';

export async function middleware(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     *   - _next/static  (static files)
     *   - _next/image   (image optimisation)
     *   - favicon.ico
     *   - Public image/font assets
     * This ensures the middleware runs on every page and API route.
     */
    '/((?!_next/static|_next/image|favicon\\.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)',
  ],
};
