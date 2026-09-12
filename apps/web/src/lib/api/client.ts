/**
 * Web Application API Client Initializer
 * Provides the swappable transport boundary. TASK-005 configures only the deterministic mock.
 */

import { HttpApiClient, MockApiClient, mockApiClient, type ApiClient } from '@lingua/types';
import { getBrowserSupabaseClient } from '../supabase/client';
import { createSupabaseAuthTokenProvider } from '../supabase/token-provider';

let activeApiClient: ApiClient | null = null;

/**
 * Raised when a hosted build is missing the live transport prerequisites.
 *
 * Development and test builds intentionally keep the deterministic mock
 * transport available, but a staging/production build must never silently
 * present fixtures as product data.
 */
export class ApiConfigurationError extends Error {
  readonly code = 'API_CONFIGURATION_ERROR' as const;

  constructor() {
    super('Live API configuration is incomplete.');
    this.name = 'ApiConfigurationError';
  }
}

export function isHostedRuntime(): boolean {
  const appEnvironment = (process.env.APP_ENV ?? '').trim().toLowerCase();
  return process.env.NODE_ENV === 'production' || appEnvironment === 'staging' || appEnvironment === 'production';
}

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function getApiClient(): ApiClient {
  if (activeApiClient) return activeApiClient;
  const baseUrl = getApiBaseUrl();
  const supabase = getBrowserSupabaseClient();

  // Client components are rendered once on the server during Next's build and
  // request-time SSR.  There is no browser Supabase session in that phase, so
  // keep the server render deterministic and enforce the hosted fail-closed
  // boundary when the browser actually selects a transport.
  if (
    isHostedRuntime() &&
    typeof window !== 'undefined' &&
    (baseUrl !== '/api' || !supabase)
  ) {
    throw new ApiConfigurationError();
  }

  activeApiClient = baseUrl && supabase
    ? new HttpApiClient({ baseUrl, authTokenProvider: createSupabaseAuthTokenProvider(supabase) })
    : mockApiClient;
  return activeApiClient;
}

export function setApiClient(client: ApiClient): void {
  activeApiClient = client;
}

export { MockApiClient, mockApiClient };
export { HttpApiClient };
