import { createClient } from '@/lib/supabase/server';
import { redirect } from 'next/navigation';
import Link from 'next/link';
import MobileNav from '@/components/layout/MobileNav';

export default async function ProtectedLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();

  if (!user) {
    redirect('/login');
  }

  return (
    <div className="min-h-screen bg-slate-950">
      {/* Navigation */}
      <nav className="border-b border-white/10 bg-slate-900/50 backdrop-blur-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16 items-center">
            <div className="flex items-center gap-8">
              <Link href="/dashboard" className="text-xl font-bold text-white">
                Deutsche Meister
              </Link>
              <div className="hidden md:flex gap-6">
                <Link href="/dashboard" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Dashboard</Link>
                <Link href="/courses" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Courses</Link>
                <Link href="/tutor" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">AI Tutor</Link>
                <Link href="/history" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">History</Link>
                <Link href="/profile" className="text-slate-400 hover:text-white transition-colors text-sm font-medium">Profile</Link>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-slate-400 text-sm hidden lg:block">
                {user.email}
              </span>
              <form action="/auth/signout" method="post" className="hidden md:block">
                <button type="submit" className="text-sm text-slate-400 hover:text-white transition-colors">
                  Sign out
                </button>
              </form>
              <MobileNav userEmail={user.email ?? ''} />
            </div>
          </div>
        </div>
      </nav>

      {/* Main content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {children}
      </main>
    </div>
  );
}
