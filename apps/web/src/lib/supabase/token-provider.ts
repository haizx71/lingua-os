/**
 * Canonical AuthTokenProvider implementation backed by Supabase Auth SDK.
 * Calls supabase.auth.getSession() to obtain current legitimate JWT access token.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { AuthTokenProvider } from '@lingua/types';
import { AuthTokenProviderError } from '@lingua/types';
import { getBrowserSupabaseClient } from './client';

/**
 * Creates an AuthTokenProvider from a Supabase client or getter function.
 * If no client is passed, delegates to the singleton browser client.
 */
export function createSupabaseAuthTokenProvider(
  clientOrGetter?: SupabaseClient | null | (() => SupabaseClient | null)
): AuthTokenProvider {
  return {
    async getAccessToken(): Promise<string | null> {
      let client: SupabaseClient | null = null;
      try {
        client =
          typeof clientOrGetter === 'function'
            ? clientOrGetter()
            : (clientOrGetter ?? getBrowserSupabaseClient());
      } catch (clientErr) {
        throw new AuthTokenProviderError(
          'Failed to initialize Supabase client for token retrieval',
          'INFRASTRUCTURE_ERROR',
          { cause: clientErr }
        );
      }

      if (!client) {
        // Genuine unauthenticated state (no client configured in dev/test)
        return null;
      }

      try {
        const { data, error } = await client.auth.getSession();
        if (error) {
          throw new AuthTokenProviderError(
            `Supabase session retrieval failed: ${error.message}`,
            'INFRASTRUCTURE_ERROR',
            { cause: error }
          );
        }

        if (!data.session) {
          // Legitimate absence of session
          return null;
        }

        return data.session.access_token ?? null;
      } catch (err) {
        if (err instanceof AuthTokenProviderError) {
          throw err;
        }
        throw new AuthTokenProviderError(
          'Unexpected error during session token retrieval',
          'INFRASTRUCTURE_ERROR',
          { cause: err }
        );
      }
    },
  };
}

