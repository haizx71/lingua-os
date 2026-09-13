import React from 'react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MockApiClient, type AdminContentResponseDto } from '@lingua/types';
import { AdminContentFormView } from '../../apps/web/src/features/admin/AdminContentForm';

const push = vi.fn();
const created: AdminContentResponseDto = {
  data: {
    id: '10000000-0000-4000-8000-000000000001',
    title: 'A calm first morning',
    body: 'word01 word02.',
    languageCode: 'en',
    contentType: 'article',
    level: 'A1',
    status: 'normalized',
    authorName: 'LINGUA OS owner',
    sourceName: 'LINGUA OS original articles',
    sourceVersion: 'v1',
    licenseCode: 'LINGUA-FIRST-PARTY',
    attributionText: 'Original article © LINGUA OS.',
    rightsStatement: 'Owner-authored first-party text.',
    sourceRecordKey: 'admin:10000000-0000-4000-8000-000000000001',
    rawHash: 'a'.repeat(64),
    sentences: [],
    createdAt: '2026-09-13T00:00:00Z',
    updatedAt: '2026-09-13T00:00:00Z',
  },
  meta: { requestId: '20000000-0000-4000-8000-000000000001', apiVersion: '1.0' },
};

describe('TASK-ADMIN-001 authoring form', () => {
  beforeEach(() => push.mockReset());

  it('submits explicit first-party provenance and navigates to the created detail', async () => {
    const client = new MockApiClient();
    const create = vi.spyOn(client, 'createAdminContent').mockResolvedValue(created);
    render(<AdminContentFormView apiClient={client} onCreated={(id) => push(`/admin/content/${id}`)} />);

    fireEvent.change(screen.getByLabelText('Tiêu đề'), { target: { value: created.data.title } });
    fireEvent.change(screen.getByLabelText('Nội dung tiếng Anh'), { target: { value: created.data.body } });
    fireEvent.change(screen.getByLabelText('Tác giả'), { target: { value: created.data.authorName } });
    fireEvent.change(screen.getByLabelText('Ghi công'), { target: { value: created.data.attributionText } });
    fireEvent.change(screen.getByLabelText('Xác nhận quyền sử dụng'), { target: { value: created.data.rightsStatement } });
    fireEvent.click(screen.getByRole('button', { name: 'Lưu nội dung' }));

    await waitFor(() => expect(create).toHaveBeenCalledWith(expect.objectContaining({
      languageCode: 'en',
      level: 'A1',
      title: created.data.title,
      body: created.data.body,
      attributionText: created.data.attributionText,
      rightsStatement: created.data.rightsStatement,
    })));
    expect(push).toHaveBeenCalledWith(`/admin/content/${created.data.id}`);
  });
});
