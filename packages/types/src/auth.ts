/**
 * Canonical frontend authentication & transport token abstractions.
 * Decouples API clients and product view models from Supabase Auth SDK internals.
 */

export type AuthStateKind = 'loading' | 'authenticated' | 'unauthenticated';

export interface AuthUserIdentity {
  readonly id: string;
  readonly email?: string | null;
  readonly phone?: string | null;
  readonly role?: string | null;
}

export interface AuthSessionState {
  readonly stateKind: AuthStateKind;
  readonly user: AuthUserIdentity | null;
  readonly expiresAt?: number | null;
}

/** Function signature for retrieving the current valid access token. */
export type AuthTokenProviderFn = () => Promise<string | null>;

/** Object interface for retrieving the current valid access token. */
export interface AuthTokenProvider {
  getAccessToken(): Promise<string | null>;
}

/** Helper to normalize function or object into an AuthTokenProvider. */
export function toAuthTokenProvider(provider: AuthTokenProvider | AuthTokenProviderFn): AuthTokenProvider {
  if (typeof provider === 'function') {
    return { getAccessToken: provider };
  }
  return provider;
}

/**
 * Typed error thrown when the token provider fails due to network/infrastructure issues,
 * distinguishing technical failures from the simple absence of an authenticated session (null).
 */
export class AuthTokenProviderError extends Error {
  readonly code: 'INFRASTRUCTURE_ERROR' | 'UNAUTHENTICATED';

  constructor(
    message: string,
    code: 'INFRASTRUCTURE_ERROR' | 'UNAUTHENTICATED' = 'INFRASTRUCTURE_ERROR',
    options?: { cause?: unknown }
  ) {
    super(message, options);
    this.name = 'AuthTokenProviderError';
    this.code = code;
  }
}

