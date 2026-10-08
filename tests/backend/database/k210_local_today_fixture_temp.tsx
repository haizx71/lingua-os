import React from 'react';
import { createRoot } from 'react-dom/client';
import { HttpApiClient } from '@lingua/types';
import TodayPage from '../../../apps/web/src/app/today/page';
import { AppRouteBoundary } from '../../../apps/web/src/components/auth/AppRouteBoundary';
import { AuthProvider } from '../../../apps/web/src/features/auth/AuthContext';

const apiClient = new HttpApiClient({
  baseUrl: '/api',
  authTokenProvider: { getAccessToken: async () => 'valid-token' },
});
const actorId = window.localStorage.getItem('k210-local-actor-id');
if (!actorId) throw new Error('Local test actor identity is required.');
const user = {
  id: actorId,
  app_metadata: { provider: 'email', providers: ['email'] },
  user_metadata: {},
  aud: 'authenticated',
  created_at: new Date().toISOString(),
  email: 'local-test-actor@example.invalid',
  role: 'authenticated',
};
const session = {
  access_token: 'valid-token',
  token_type: 'bearer',
  expires_in: 3600,
  expires_at: Math.floor(Date.now() / 1000) + 3600,
  refresh_token: 'local-test-refresh-token',
  user,
};
const customAuthClient = {
  auth: {
    getSession: async () => ({ data: { session }, error: null }),
    onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
  },
};
globalThis.__k2LocalApiClient = apiClient;
const container = document.getElementById('root');
if (!container) throw new Error('Local fixture root is missing.');
createRoot(container).render(
  <AuthProvider customClient={customAuthClient as never}>
    <AppRouteBoundary pathname="/today" router={{ replace: () => {} }}>
      <TodayPage />
    </AppRouteBoundary>
  </AuthProvider>,
);
