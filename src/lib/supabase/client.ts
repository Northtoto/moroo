import { createBrowserClient } from '@supabase/ssr';

// NEXT_PUBLIC_* vars must be accessed as static string literals
// so Next.js can inline-replace them at build time (client bundle).
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!;

export function createClient() {
  if (!supabaseUrl || !supabaseAnonKey) {
    throw new Error('Missing Supabase environment variables');
  }
  return createBrowserClient(supabaseUrl, supabaseAnonKey);
}
