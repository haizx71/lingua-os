/**
 * Server Supabase client for Next.js App Router.
 * Uses @supabase/ssr createServerClient with Next.js cookies().
 */

import { createServerClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { cookies } from 'next/headers';
import { getSupabasePublicConfig } from './config';

/**
 * Creates a server Supabase client for Server Components, Server Actions, or Route Handlers.
 * Uses Next.js cookies() to read and set auth session cookies.
 */
export async function createServerSupabaseClient(url?: string, anonKey?: string): Promise<SupabaseClient> {
  const config = getSupabasePublicConfig();
  const targetUrl = (url ?? config.supabaseUrl).trim();
  const targetKey = (anonKey ?? config.supabaseAnonKey).trim();

  if (!targetUrl || !targetKey) {
    throw new Error(
      'Supabase public configuration (URL and anon key) is required to create server client.'
    );
  }

  const cookieStore = await cookies();

  return createServerClient(targetUrl, targetKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: Array<{ name: string; value: string; options?: Record<string, unknown> }>) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options as Parameters<typeof cookieStore.set>[2]);
          });
        } catch {
          // The setAll method was called from a Server Component.
          // This can be ignored if middleware is refreshing user sessions.
        }
      },
    },
  });
}

