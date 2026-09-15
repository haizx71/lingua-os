'use client';

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User, SupabaseClient } from '@supabase/supabase-js';
import type { AuthStateKind, AuthUserIdentity } from '@lingua/types';
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
  readonly actorEpoch: number;
  getActorEpoch(): number;
  isCurrentActor(epoch: number, actorId?: string | null): boolean;
  getAccessToken(): Promise<string | null>;
  signIn(email: string, password: string): Promise<{ session: Session | null; user: User | null }>;
  signUp(email: string, password: string): Promise<{ session: Session | null; user: User | null }>;
  requestPasswordReset(email: string): Promise<void>;
  resendSignupConfirmation(email: string): Promise<void>;
  updateEmail(email: string): Promise<User>;
  updatePassword(password: string, currentPassword?: string): Promise<User>;
  signOut(): Promise<void>;
  signOutEverywhere(): Promise<void>;
  refreshSession(): Promise<void>;
  clearError(): void;
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

function authError(value: unknown, fallback: string): Error {
  if (value instanceof Error) return value;
  if (value && typeof value === 'object' && 'message' in value) {
    const message = String((value as { message?: unknown }).message ?? fallback);
    return new Error(message);
  }
  return new Error(fallback);
}

function absoluteAppUrl(path: string): string | undefined {
  if (typeof window === 'undefined') return undefined;
  return new URL(path, window.location.origin).toString();
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children, customClient }) => {
  const [authState, setAuthState] = useState<AuthStateKind>('loading');
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const currentActorIdRef = useRef<string | null>(null);
  const actorEpochRef = useRef<number>(1);
  const [actorEpoch, setActorEpoch] = useState<number>(1);

  const getActorEpoch = useCallback((): number => actorEpochRef.current, []);

  const isCurrentActor = useCallback((epoch: number, actorId?: string | null): boolean => {
    if (epoch !== actorEpochRef.current) return false;
    if (actorId !== undefined && actorId !== currentActorIdRef.current) return false;
    return true;
  }, []);

  const client = useMemo(() => {
    return customClient !== undefined ? customClient : getBrowserSupabaseClient();
  }, [customClient]);

  const isConfigured = Boolean(client);

  const updateSessionState = useCallback((currentSession: Session | null, preserveError = false) => {
    const nextActorId = currentSession?.user?.id ?? null;
    if (currentActorIdRef.current !== nextActorId) {
      currentActorIdRef.current = nextActorId;
      actorEpochRef.current += 1;
      setActorEpoch(actorEpochRef.current);
    }
    try {
      getApiClient().setActor?.(nextActorId);
    } catch {
      // The live transport may not be initialized during auth bootstrap.
    }
    setSession(currentSession);
    setUser(currentSession?.user ?? null);
    setAuthState(currentSession ? 'authenticated' : 'unauthenticated');
    if (!preserveError) setError(null);
  }, []);

  const clearError = useCallback(() => setError(null), []);

  const getAccessToken = useCallback(async (): Promise<string | null> => {
    return createSupabaseAuthTokenProvider(client).getAccessToken();
  }, [client]);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const { data, error: signInError } = await client.auth.signInWithPassword({ email, password });
    if (signInError) {
      const errorObj = authError(signInError, 'Sign in failed');
      setError(errorObj);
      throw errorObj;
    }
    updateSessionState(data.session);
    return { session: data.session, user: data.user };
  }, [client, updateSessionState]);

  const signUp = useCallback(async (email: string, password: string) => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const emailRedirectTo = absoluteAppUrl('/auth/confirm?next=/onboarding');
    const credentials = emailRedirectTo
      ? { email, password, options: { emailRedirectTo } }
      : { email, password };
    const { data, error: signUpError } = await client.auth.signUp(credentials);
    if (signUpError) {
      const errorObj = authError(signUpError, 'Sign up failed');
      setError(errorObj);
      throw errorObj;
    }
    updateSessionState(data.session);
    return { session: data.session, user: data.user };
  }, [client, updateSessionState]);

  const requestPasswordReset = useCallback(async (email: string): Promise<void> => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const redirectTo = absoluteAppUrl('/auth/confirm?next=/auth/reset-password');
    const { error: resetError } = await client.auth.resetPasswordForEmail(
      email,
      redirectTo ? { redirectTo } : undefined
    );
    if (resetError) {
      const errorObj = authError(resetError, 'Password reset request failed');
      setError(errorObj);
      throw errorObj;
    }
  }, [client]);

  const resendSignupConfirmation = useCallback(async (email: string): Promise<void> => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const emailRedirectTo = absoluteAppUrl('/auth/confirm?next=/onboarding');
    const { error: resendError } = await client.auth.resend({
      type: 'signup',
      email,
      ...(emailRedirectTo ? { options: { emailRedirectTo } } : {}),
    });
    if (resendError) {
      const errorObj = authError(resendError, 'Confirmation email could not be resent');
      setError(errorObj);
      throw errorObj;
    }
  }, [client]);

  const updateEmail = useCallback(async (email: string): Promise<User> => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const { data, error: updateError } = await client.auth.updateUser({ email });
    if (updateError || !data.user) {
      const errorObj = authError(updateError, 'Email update failed');
      setError(errorObj);
      throw errorObj;
    }
    setUser(data.user);
    setSession((current) => (current ? { ...current, user: data.user } : current));
    return data.user;
  }, [client]);

  const updatePassword = useCallback(async (password: string, currentPassword?: string): Promise<User> => {
    if (!client) throw new Error('Supabase Auth chưa được cấu hình.');
    setError(null);
    const attributes = currentPassword ? { password, currentPassword } : { password };
    const { data, error: updateError } = await client.auth.updateUser(attributes);
    if (updateError || !data.user) {
      const errorObj = authError(updateError, 'Password update failed');
      setError(errorObj);
      throw errorObj;
    }
    setUser(data.user);
    setSession((current) => (current ? { ...current, user: data.user } : current));
    return data.user;
  }, [client]);

  const performSignOut = useCallback(async (scope: 'local' | 'global'): Promise<void> => {
    if (!client) {
      updateSessionState(null);
      return;
    }
    try {
      const { error: signOutError } = await client.auth.signOut({ scope });
      if (signOutError) {
        const errorObj = authError(signOutError, 'Sign out failed');
        setError(errorObj);
        try {
          const { data } = await client.auth.getSession();
          updateSessionState(data.session, true);
        } catch {
          // Preserve the current actor when even the re-sync fails.
        }
        return;
      }
      updateSessionState(null);
    } catch (err) {
      setError(authError(err, 'Sign out failed'));
      try {
        const { data } = await client.auth.getSession();
        updateSessionState(data.session, true);
      } catch {
        // Preserve the current actor when even the re-sync fails.
      }
    }
  }, [client, updateSessionState]);

  const signOut = useCallback(async (): Promise<void> => performSignOut('local'), [performSignOut]);
  const signOutEverywhere = useCallback(async (): Promise<void> => performSignOut('global'), [performSignOut]);

  const refreshSession = useCallback(async (): Promise<void> => {
    if (!client) {
      updateSessionState(null);
      return;
    }
    try {
      const { data, error: refreshError } = await client.auth.refreshSession();
      if (refreshError) {
        setError(authError(refreshError, 'Session refresh failed'));
        return;
      }
      updateSessionState(data.session);
    } catch (err) {
      setError(authError(err, 'Session refresh failed'));
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

    client.auth
      .getSession()
      .then(({ data, error: getSessionError }) => {
        if (!isMounted) return;
        if (getSessionError) {
          setError(authError(getSessionError, 'Session bootstrap error'));
          updateSessionState(null, true);
        } else {
          updateSessionState(data.session);
        }
      })
      .catch((err) => {
        if (!isMounted) return;
        setError(authError(err, 'Session bootstrap error'));
        updateSessionState(null, true);
      });

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
    if (!isConfigured) return;
    try {
      getApiClient().setActor?.(user?.id ?? null);
    } catch {
      // Hosted configuration errors are surfaced by the readiness boundary.
    }
  }, [isConfigured, user]);

  const userIdentity = useMemo(() => mapSupabaseUserToIdentity(user), [user]);

  const contextValue = useMemo<AuthContextValue>(
    () => ({
      authState,
      session,
      user,
      userIdentity,
      error,
      isConfigured,
      actorEpoch,
      getActorEpoch,
      isCurrentActor,
      getAccessToken,
      signIn,
      signUp,
      requestPasswordReset,
      resendSignupConfirmation,
      updateEmail,
      updatePassword,
      signOut,
      signOutEverywhere,
      refreshSession,
      clearError,
    }),
    [
      authState,
      session,
      user,
      userIdentity,
      error,
      isConfigured,
      actorEpoch,
      getActorEpoch,
      isCurrentActor,
      getAccessToken,
      signIn,
      signUp,
      requestPasswordReset,
      resendSignupConfirmation,
      updateEmail,
      updatePassword,
      signOut,
      signOutEverywhere,
      refreshSession,
      clearError,
    ]
  );

  return <AuthContext.Provider value={contextValue}>{children}</AuthContext.Provider>;
};

export function useOptionalAuth(): AuthContextValue | null {
  return useContext(AuthContext);
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used within an AuthProvider');
  return context;
}
