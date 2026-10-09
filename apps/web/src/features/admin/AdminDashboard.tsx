'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Badge, Button, Card, EmptyState, InlineAlert, LoadingState } from '@lingua/ui';
import { mapApiErrorToUi, type ApiClient } from '@lingua/types';
import { getApiClient } from '../../lib/api/client';
import { listAdminContent, type AdminContentViewModel } from './adapters';

export function AdminDashboard({ apiClient = getApiClient() }: { apiClient?: ApiClient }) {
  const [items, setItems] = useState<readonly AdminContentViewModel[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void listAdminContent(apiClient)
      .then((value) => { if (active) setItems(value); })
      .catch((reason) => { if (active) setError(mapApiErrorToUi(reason).message); });
    return () => { active = false; };
  }, [apiClient]);

  if (error) return <InlineAlert variant="danger" title="Không thể mở khu vực quản trị">{error}</InlineAlert>;
  if (!items) return <LoadingState message="Đang tải nội dung quản trị..." count={2} />;

  const statusLabel = (status: string) => ({
    draft: 'Bản nháp',
    reviewed: 'Đã kiểm tra',
    published: 'Đã phát hành',
    retired: 'Đã ngừng phát hành',
  }[status] ?? 'Trạng thái khác');

  return (
    <div className="mx-auto w-full max-w-5xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="lingua-kicker text-[var(--action-primary)]">Quản trị nội dung</p>
          <h1 className="mt-2 text-3xl font-bold tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Bài đọc</h1>
          <p className="mt-2 text-sm leading-6 text-[var(--text-secondary)]">Soạn, rà soát và quản lý nội dung đã xuất bản.</p>
        </div>
        <Link href="/admin/content/new"><Button>Nội dung mới</Button></Link>
      </header>
      {items.length === 0 ? (
          <EmptyState title="Chưa có nội dung" description="Tạo bài đọc đầu tiên để bắt đầu." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="min-w-0 p-4 sm:p-5">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <h2 className="break-words font-bold text-[var(--text-primary)]">{item.title}</h2>
                  <p className="mt-1 text-xs text-[var(--text-secondary)]">{item.level} · {item.sentences.length} câu</p>
                </div>
                <div className="flex shrink-0 items-center justify-between gap-4 sm:justify-end">
                  <Badge variant={item.status === 'published' ? 'success' : item.status === 'reviewed' ? 'primary' : 'neutral'} size="sm">{statusLabel(item.status)}</Badge>
                  <Link className="inline-flex min-h-11 items-center rounded-xl px-3 text-sm font-bold text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" href={`/admin/content/${item.id}`}>Mở bài</Link>
                </div>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
