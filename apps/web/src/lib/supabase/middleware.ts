/**
 * Canonical Supabase SSR Session Refresh Middleware helper for Next.js App Router.
 * Refreshes auth tokens and synchronizes updated cookies across request and response.
 * Uses `supabase.auth.getClaims()` per official Supabase SSR security recommendations.
 * Propagates response and cache-control headers provided by @supabase/ssr setAll.
 */

import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';
import { getSupabasePublicConfig } from './config';

export async function updateSession(request: NextRequest): Promise<NextResponse> {
  let supabaseResponse = NextResponse.next({
    request,
  });

  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabasePublicConfig();
  if (!isConfigured) {
    return supabaseResponse;
  }

  const supabase = createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet, headers) {
        cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
        supabaseResponse = NextResponse.next({
          request,
        });
        cookiesToSet.forEach(({ name, value, options }) =>
          supabaseResponse.cookies.set(name, value, options)
        );
        if (headers) {
          Object.entries(headers).forEach(([key, value]) => {
            supabaseResponse.headers.set(key, value);
          });
        }
      },
    },
  });

  // IMPORTANT: Use getClaims() for server-side JWT session validation per current Supabase SSR guidance.
  // This automatically triggers session token refresh if the current JWT has expired.
  // Fallback to getUser() if getClaims() is not present on older client typings.
  if (typeof (supabase.auth as unknown as { getClaims?: () => Promise<unknown> }).getClaims === 'function') {
    await (supabase.auth as unknown as { getClaims: () => Promise<unknown> }).getClaims();
  } else {
    await supabase.auth.getUser();
  }

  return supabaseResponse;
}
