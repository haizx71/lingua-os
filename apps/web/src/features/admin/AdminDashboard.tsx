'use client';

import Link from 'next/link';
import React, { useEffect, useState } from 'react';
import { Button, Card, EmptyState, InlineAlert, LoadingState } from '@lingua/ui';
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

  return (
    <div className="max-w-4xl space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">Owner Admin</p>
          <h1 className="mt-1 text-2xl font-bold text-[var(--text-primary)] sm:text-3xl">Nội dung LINGUA OS</h1>
          <p className="mt-1 text-sm text-[var(--text-secondary)]">Soạn và xuất bản bài đọc tiếng Anh do LINGUA OS sở hữu.</p>
        </div>
        <Link href="/admin/content/new"><Button>Nội dung mới</Button></Link>
      </header>
      {items.length === 0 ? (
        <EmptyState title="Chưa có nội dung" description="Tạo micro-article đầu tiên để bắt đầu." />
      ) : (
        <div className="space-y-3">
          {items.map((item) => (
            <Card key={item.id} className="p-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <h2 className="font-semibold text-[var(--text-primary)]">{item.title}</h2>
                  <p className="text-sm text-[var(--text-secondary)]">{item.level} · {item.status} · {item.sentences.length} câu</p>
                </div>
                <Link className="text-sm font-medium text-[var(--action-primary)]" href={`/admin/content/${item.id}`}>Mở</Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
