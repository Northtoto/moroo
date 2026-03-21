'use client';
import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import Link from 'next/link';

export default function WelcomePage() {
  const router = useRouter();
  const params = useSearchParams();
  const [status, setStatus] = useState<'loading' | 'pending' | 'unauthenticated'>('loading');

  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) {
        setStatus('unauthenticated');
        return;
      }
      const { data: sub } = await supabase
        .from('subscriptions')
        .select('tier, status')
        .eq('user_id', user.id)
        .single();

      if (sub?.status === 'active' && sub?.tier === 'premium') {
        router.replace('/dashboard');
      } else {
        setStatus('pending');
      }
    });
  }, [router]);

  if (status === 'loading') {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500">Einen Moment…</p>
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return (
      <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
        <h1 className="text-3xl font-bold text-gray-900">Willkommen bei Morodeutsch!</h1>
        <p className="text-gray-600 max-w-md">
          Du hast erfolgreich in der Skool-Community bezahlt. Erstelle jetzt deinen Account
          mit <strong>derselben E-Mail-Adresse</strong>, die du bei Skool verwendet hast.
        </p>
        <Link
          href="/signup?source=skool"
          className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
        >
          Account erstellen &rarr;
        </Link>
        <Link href="/login?redirect=/dashboard" className="text-sm text-gray-500 underline">
          Ich habe bereits einen Account
        </Link>
      </main>
    );
  }

  // pending — logged in but not yet premium
  return (
    <main className="flex flex-col items-center justify-center min-h-screen gap-6 p-8 text-center">
      <h1 className="text-3xl font-bold text-gray-900">Fast geschafft!</h1>
      <p className="text-gray-600 max-w-md">
        Dein Account ist noch nicht als Premium freigeschaltet. Stelle sicher, dass du
        dieselbe E-Mail-Adresse wie bei Skool verwendet hast.
      </p>
      <Link
        href="/pricing?reason=premium_required"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700 font-medium"
      >
        Zur Pricing-Seite
      </Link>
      <a
        href="mailto:support@morodeutsch.com?subject=Premium-Zugang"
        className="text-sm text-gray-500 underline"
      >
        Support kontaktieren
      </a>
    </main>
  );
}
