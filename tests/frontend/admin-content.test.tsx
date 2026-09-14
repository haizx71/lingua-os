import React from 'react';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import type { Session, SupabaseClient, User } from '@supabase/supabase-js';
import {
  HttpApiClient,
  MockApiClient,
  type AdminContentDto,
  type AdminContentListResponseDto,
  type AdminContentResponseDto,
} from '@lingua/types';
import { AdminDashboard } from '../../apps/web/src/features/admin/AdminDashboard';
import { AdminContentDetail } from '../../apps/web/src/features/admin/AdminContentDetail';
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
  sentences: [{
    id: '20000000-0000-4000-8000-000000000001',
    order: 0,
    text: 'A calm first morning.',
    conceptCount: 1,
    concepts: [{
      concept: {
        id: '60000000-0000-4000-8000-000000000001',
        conceptType: 'word',
        canonicalForm: 'calm',
        partOfSpeech: 'adjective',
        definition: 'Not agitated.',
      },
      startOffset: 2,
      endOffset: 6,
      occurrenceRole: 'target',
      surfaceText: 'calm',
    }],
  }],
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

  it('uses owner-only catalog and exact occurrence mutation paths over HTTP', async () => {
    const fetchFn = vi.fn(async () => new Response(JSON.stringify({
      data: [],
      meta: response.meta,
    }), { status: 200, headers: { 'Content-Type': 'application/json' } }));
    const client = new HttpApiClient({
      baseUrl: '/api',
      authTokenProvider: async () => 'private-token',
      fetchFn: fetchFn as typeof fetch,
    });

    await client.searchAdminConcepts({ query: 'calm' });
    expect(fetchFn).toHaveBeenLastCalledWith('/api/v1/admin/concepts/search?query=calm', expect.objectContaining({ method: 'GET' }));
    await client.putAdminSentenceConcept({
      contentId: content.id,
      sentenceId: content.sentences[0].id,
      conceptId: content.sentences[0].concepts[0].concept.id,
      body: { startOffset: 2, endOffset: 6, occurrenceRole: 'target' },
    });
    expect(fetchFn).toHaveBeenLastCalledWith(
      `/api/v1/admin/content/${content.id}/sentences/${content.sentences[0].id}/concepts/${content.sentences[0].concepts[0].concept.id}`,
      expect.objectContaining({ method: 'PUT', body: JSON.stringify({ startOffset: 2, endOffset: 6, occurrenceRole: 'target' }) }),
    );
    await client.deleteAdminSentenceConcept({
      contentId: content.id,
      sentenceId: content.sentences[0].id,
      conceptId: content.sentences[0].concepts[0].concept.id,
      query: { startOffset: 2, endOffset: 6 },
    });
    expect(fetchFn).toHaveBeenLastCalledWith(
      expect.stringContaining('?startOffset=2&endOffset=6'),
      expect.objectContaining({ method: 'DELETE' }),
    );
  });

  it('maps a selected sentence span to a searched catalog concept and shows readiness', async () => {
    const unmapped: AdminContentDto = {
      ...content,
      body: 'Words can change.',
      sentences: [{ ...content.sentences[0], text: 'Words can change.', conceptCount: 0, concepts: [] }],
    };
    const mapped: AdminContentDto = {
      ...unmapped,
      sentences: [{
        ...unmapped.sentences[0],
        conceptCount: 1,
        concepts: [{
          concept: content.sentences[0].concepts[0].concept,
          startOffset: 0,
          endOffset: 5,
          occurrenceRole: 'target',
          surfaceText: 'Words',
        }],
      }],
    };
    const detail = (data: AdminContentDto): AdminContentResponseDto => ({ data, meta: response.meta });
    const client = new MockApiClient();
    vi.spyOn(client, 'getAdminContent').mockResolvedValue(detail(unmapped));
    vi.spyOn(client, 'searchAdminConcepts').mockResolvedValue({
      data: [content.sentences[0].concepts[0].concept],
      meta: response.meta,
    });
    const put = vi.spyOn(client, 'putAdminSentenceConcept').mockResolvedValue(detail(mapped));

    render(<AdminContentDetail contentId={content.id} apiClient={client} />);
    expect(await screen.findByText('0/1 câu đã sẵn sàng')).toBeInTheDocument();
    const sentence = screen.getByLabelText('Văn bản câu 1');
    const textNode = sentence.firstChild;
    expect(textNode).not.toBeNull();
    const range = document.createRange();
    range.setStart(textNode!, 0);
    range.setEnd(textNode!, 5);
    const selection = window.getSelection();
    selection?.removeAllRanges();
    selection?.addRange(range);
    fireEvent.mouseUp(sentence);
    expect(screen.getByText(/Đoạn đã chọn:/)).toHaveTextContent('Words [0, 5)');

    fireEvent.change(screen.getByLabelText('Tìm concept cho câu 1'), { target: { value: 'calm' } });
    fireEvent.click(screen.getByRole('button', { name: 'Tìm' }));
    expect(await screen.findByText('Not agitated.')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Thêm calm' }));
    await waitFor(() => expect(put).toHaveBeenCalledWith(expect.objectContaining({
      body: { startOffset: 0, endOffset: 5, occurrenceRole: 'target' },
    })));
    expect(await screen.findByText('1/1 câu đã sẵn sàng')).toBeInTheDocument();
    expect(screen.getByLabelText('Concept của câu 1')).toHaveTextContent('Words → calm');
  });

  it('removes the exact persisted occurrence and returns the sentence to missing status', async () => {
    const detail = (data: AdminContentDto): AdminContentResponseDto => ({ data, meta: response.meta });
    const unmapped: AdminContentDto = {
      ...content,
      sentences: [{ ...content.sentences[0], conceptCount: 0, concepts: [] }],
    };
    const client = new MockApiClient();
    vi.spyOn(client, 'getAdminContent').mockResolvedValue(detail(content));
    const remove = vi.spyOn(client, 'deleteAdminSentenceConcept').mockResolvedValue(detail(unmapped));

    render(<AdminContentDetail contentId={content.id} apiClient={client} />);
    fireEvent.click(await screen.findByRole('button', { name: 'Gỡ calm' }));
    await waitFor(() => expect(remove).toHaveBeenCalledWith({
      contentId: content.id,
      sentenceId: content.sentences[0].id,
      conceptId: content.sentences[0].concepts[0].concept.id,
      query: { startOffset: 2, endOffset: 6 },
    }));
    expect(await screen.findByText('0/1 câu đã sẵn sàng')).toBeInTheDocument();
    expect(screen.getByText('Chưa ánh xạ concept')).toBeInTheDocument();
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
