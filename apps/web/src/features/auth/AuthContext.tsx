'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useMemo } from 'react';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { AuthStateKind, AuthUserIdentity, AuthTokenProvider } from '@lingua/types';
import { getBrowserSupabaseClient } from '../../lib/supabase/client';
import { createSupabaseAuthTokenProvider } from '../../lib/supabase/token-provider';
import { getApiClient } from '../../lib/api/client';

export interface AuthContextValue {
  readonly authState: AuthStateKind;
  readonly session: Session | null;
  readonly user: User | null;
  readonly userIdentity: AuthUserIdentity | null;
  readonly error: Error | null;
  readonly isConfigured: boolean;
  getAccessToken(): Promise<string | null>;
  signIn(email: string, password: string): Promise<{ session: Session | null; user: User | null }>;
  signUp(email: string, password: string): Promise<{ session: Session | null; user: User | null }>;
  signOut(): Promise<void>;
  refreshSession(): Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export interface AuthProviderProps {
  readonly children: React.ReactNode;
  readonly customClient?: SupabaseClient | null;
}

function mapSupabaseUserToIdentity(user: User | null): AuthUserIdentity | null {
  if (!user) return null;
  return {
    id: user.id,
    email: user.email ?? null,
    phone: user.phone ?? null,
    role: user.role ?? null,
  };
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, customClient }) => {
  const [authState, setAuthState] = useState<AuthStateKind>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);

  const client = useMemo(() => {
    return customClient !== undefined ? customClient : getBrowserSupabaseClient();
  }, [customClient]);

  const isConfigured = Boolean(client);

  const updateSessionState = useCallback((currentSession: Session | null, preserveError = false) => {
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setAuthState(currentSession ? 'authenticated' : 'unauthenticated');
    if (!preserveError) {
      setError(null);
    }
  }, []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return createSupabaseAuthTokenProvider(client).getAccessToken();
  }, [client]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) {
      const errorObj = new Error(signInError.message);
      setError(errorObj);
      throw errorObj;
    }
    updateSessionState(data.session);
    return { session: data.session, user: data.user };
  }, [client, updateSessionState]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const { data, error: signUpError } = await client.auth.signUp({ email, password });
    if (signUpError) {
      const errorObj = new Error(signUpError.message);
      setError(errorObj);
      throw errorObj;
    }
    updateSessionState(data.session);
    return { session: data.session, user: data.user };
  }, [client, updateSessionState]);

  const signOut = useCallback(async (): Promise<void> => {
    if (!client) {
      updateSessionState(null);
      return;
    }
    try {
      const { error: signOutError } = await client.auth.signOut();
      if (signOutError) {
        const errorObj =
          signOutError instanceof Error
            ? signOutError
            : new Error((signOutError as { message?: string })?.message || 'Sign out failed');
        setError(errorObj);

        // Do NOT falsely clear authenticated state on error; re-synchronize actual session while preserving error.
        try {
          const { data } = await client.auth.getSession();
          updateSessionState(data.session, true);
        } catch {
          // Keep current state if re-fetch also fails
        }
        return;
      }
      // On success, transition to unauthenticated.
      updateSessionState(null);
    } catch (err) {
      const errorObj = err instanceof Error ? err : new Error('Sign out failed');
      setError(errorObj);
      try {
        const { data } = await client.auth.getSession();
        updateSessionState(data.session, true);
      } catch {
        // Keep current state
      }
    }
  }, [client, updateSessionState]);



  const refreshSession = useCallback(async (): Promise<void> => {
    if (!client) {
      updateSessionState(null);
      return;
    }
    try {
      const { data, error: refreshError } = await client.auth.refreshSession();
      if (refreshError) {
        const errorObj = refreshError instanceof Error
          ? refreshError
          : new Error(String((refreshError as unknown as { message?: unknown }).message ?? 'Session refresh failed'));
        setError(errorObj);
        // A refresh failure is not proof that the user signed out. Keep the
        // existing session until Supabase emits an authoritative state change.
        return;
      }
      updateSessionState(data.session);
    } catch (err) {
      setError(err instanceof Error ? err : new Error('Session refresh failed'));
    }
  }, [client, updateSessionState]);

  useEffect(() => {
    if (!client) {
      setAuthState('unauthenticated');
      setSession(null);
      setUser(null);
      return;
    }

    let isMounted = true;

    // Initial session bootstrap
    client.auth
      .getSession()
      .then(({ data, error: getSessionError }) => {
        if (!isMounted) return;
        if (getSessionError) {
          setError(getSessionError);
          updateSessionState(null, true);
        } else {
          updateSessionState(data.session);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(err instanceof Error ? err : new Error('Session bootstrap error'));
        updateSessionState(null, true);
      });

    // Subscribe to auth state changes (sign in, sign out, token refreshed)
    const {
      data: { subscription },
    } = client.auth.onAuthStateChange((_event, newSession) => {
      if (!isMounted) return;
      updateSessionState(newSession);
    });

    return () => {
      isMounted = false;
      subscription.unsubscribe();
    };
  }, [client, updateSessionState]);

  useEffect(() => {
    const apiClient = getApiClient();
    apiClient.setActor?.(user?.id ?? null);
  }, [user]);

  const userIdentity = useMemo(() => mapSupabaseUserToIdentity(user), [user]);

  const contextValue: AuthContextValue = useMemo(
    () => ({
      authState,
      session,
      user,
      userIdentity,
      error,
      isConfigured,
      getAccessToken,
      signIn,
      signUp,
      signOut,
      refreshSession,
    }),
    [authState, session, user, userIdentity, error, isConfigured, getAccessToken, signIn, signUp, signOut, refreshSession]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
