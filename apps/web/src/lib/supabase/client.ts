/**
 * Browser Supabase Auth client for Next.js App Router.
 * Uses @supabase/ssr createBrowserClient with browser cookie storage.
 */

import { createBrowserClient } from '@supabase/ssr';
import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabasePublicConfig } from './config';

let browserClientInstance: SupabaseClient | null = null;

/**
 * Creates or returns the singleton browser Supabase client.
 * Returns null if not in browser environment or if public configuration is missing.
 */
export function getBrowserSupabaseClient(forceNew = false): SupabaseClient | null {
  if (typeof window === 'undefined') {
    return null;
  }

  if (browserClientInstance && !forceNew) {
    return browserClientInstance;
  }

  const { supabaseUrl, supabaseAnonKey, isConfigured } = getSupabasePublicConfig();
  if (!isConfigured) {
    return null;
  }

  browserClientInstance = createBrowserClient(supabaseUrl, supabaseAnonKey);
  return browserClientInstance;
}

/**
 * Factory function to create a new browser Supabase client with explicit or environment config.
 */
export function createBrowserSupabaseClient(url?: string, anonKey?: string): SupabaseClient {
  const config = getSupabasePublicConfig();
  const targetUrl = (url ?? config.supabaseUrl).trim();
  const targetKey = (anonKey ?? config.supabaseAnonKey).trim();

  if (!targetUrl || !targetKey) {
    throw new Error(
      'Supabase public configuration (URL and anon key) is required to create browser client.'
    );
  }

  return createBrowserClient(targetUrl, targetKey);
}
