import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  HttpApiClient,
  MockApiClient,
  type AdminContentDto,
  type AdminContentListResponseDto,
} from '@lingua/types';
import { AdminDashboard } from '../../apps/web/src/features/admin/AdminDashboard';
import { toAdminContentViewModel } from '../../apps/web/src/features/admin/adapters';
import { AuthProvider } from '../../apps/web/src/features/auth/AuthContext';
import { AppRouteBoundary } from '../../apps/web/src/components/auth/AppRouteBoundary';
import { setApiClient } from '../../apps/web/src/lib/api/client';

const content: AdminContentDto = {
  id: '10000000-0000-4000-8000-000000000001',
  title: 'A calm first morning',
  body: 'A calm first morning.',
  languageCode: 'en',
  contentType: 'article',
  level: 'A1',
  status: 'normalized',
  authorName: 'LINGUA OS owner',
  sourceName: 'LINGUA OS original articles',
  sourceVersion: 'v1',
  licenseCode: 'LINGUA-FIRST-PARTY',
  attributionText: 'Original article © LINGUA OS.',
  rightsStatement: 'Owner-authored content.',
  sourceRecordKey: 'admin:10000000-0000-4000-8000-000000000001',
  rawHash: 'a'.repeat(64),
  sentences: [{ id: '20000000-0000-4000-8000-000000000001', order: 0, text: 'A calm first morning.', conceptCount: 1 }],
  createdAt: '2026-09-13T00:00:00Z',
  updatedAt: '2026-09-13T00:00:00Z',
};
const response: AdminContentListResponseDto = {
  data: [content],
  meta: { requestId: '30000000-0000-4000-8000-000000000001', apiVersion: '1.0' },
};

describe('TASK-ADMIN-001 frontend boundary', () => {
  it('maps authoritative DTOs into an admin view model without inventing metadata', () => {
    const view = toAdminContentViewModel(content);
    expect(view).toMatchObject({ title: content.title, status: 'normalized', publishedAt: null });
    expect(view.sentences).toEqual(content.sentences);
  });

  it('renders the minimal admin list through the ApiClient boundary', async () => {
    const client = new MockApiClient();
    vi.spyOn(client, 'listAdminContent').mockResolvedValue(response);
    render(<AdminDashboard apiClient={client} />);

    expect(await screen.findByRole('heading', { name: 'Nội dung LINGUA OS' })).toBeInTheDocument();
    expect(screen.getByText('A calm first morning')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nội dung mới' })).toHaveAttribute('href', '/admin/content/new');
  });

  it('uses bearer-authenticated versioned admin paths over the real HTTP transport', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify(response), {
      status: 200,
      headers: { 'Content-Type': 'application/json' },
    }));
    const client = new HttpApiClient({
      baseUrl: '/api',
      authTokenProvider: async () => 'private-token',
      fetchFn: fetchFn as typeof fetch,
      actorId: '40000000-0000-4000-8000-000000000001',
    });

    await client.listAdminContent();
    expect(fetchFn).toHaveBeenCalledWith('/api/v1/admin/content', expect.objectContaining({
      method: 'GET',
      headers: expect.objectContaining({ Authorization: 'Bearer private-token' }),
    }));
  });

  it('does not expose the server owner allowlist name in browser source', () => {
    for (const path of [
      'apps/web/src/lib/api/client.ts',
      'apps/web/src/features/auth/AuthContext.tsx',
      'apps/web/src/features/admin/AdminDashboard.tsx',
    ]) {
      expect(readFileSync(join(process.cwd(), path), 'utf8')).not.toContain('LINGUA_ADMIN_USER_IDS');
    }
  });

  it('requires authentication but skips learner bootstrap/readiness for /admin', async () => {
    const user = { id: '50000000-0000-4000-8000-000000000001', email: 'owner@example.test', role: 'authenticated' } as User;
    const session = { access_token: 'valid-token', token_type: 'bearer', user } as Session;
    const supabase = {
      auth: {
        getSession: vi.fn(async () => ({ data: { session }, error: null })),
        onAuthStateChange: vi.fn(() => ({ data: { subscription: { unsubscribe: vi.fn() } } })),
      },
    } as unknown as SupabaseClient;
    const api = new MockApiClient();
    const getMe = vi.spyOn(api, 'getMe');
    setApiClient(api);

    render(
      <AuthProvider customClient={supabase}>
        <AppRouteBoundary pathname="/admin" router={{ replace: vi.fn() }}>
          <div>Owner content surface</div>
        </AppRouteBoundary>
      </AuthProvider>,
    );

    expect(await screen.findByText('Owner content surface')).toBeInTheDocument();
    await waitFor(() => expect(getMe).not.toHaveBeenCalled());
  });
});
