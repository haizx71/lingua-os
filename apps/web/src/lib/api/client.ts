/**
 * Web Application API Client Initializer
 * Provides the swappable transport boundary. TASK-005 configures only the deterministic mock.
 */

import { HttpApiClient, MockApiClient, mockApiClient, type ApiClient } from '@lingua/types';
import { getBrowserSupabaseClient } from '../supabase/client';
import { createSupabaseAuthTokenProvider } from '../supabase/token-provider';

let activeApiClient: ApiClient | null = null;

export function getApiBaseUrl(): string {
  return (process.env.NEXT_PUBLIC_API_BASE_URL ?? '').trim().replace(/\/+$/, '');
}

export function getApiClient(): ApiClient {
  if (activeApiClient) return activeApiClient;
  const baseUrl = getApiBaseUrl();
  const supabase = getBrowserSupabaseClient();
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
