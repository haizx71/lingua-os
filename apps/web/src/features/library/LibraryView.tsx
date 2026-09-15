'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { Badge, Button, Card, EmptyState, ErrorState, InlineAlert, LoadingState } from '@lingua/ui';
import { BookOpen, Bookmark, Clock, Trash2 } from 'lucide-react';
import { type ApiClient, type ApiErrorCode, type LibraryItemViewModel } from '@lingua/types';
import { useLibrary } from './useLibrary';

type LibraryFilter = 'all' | LibraryItemViewModel['itemType'];

export interface LibraryViewProps {
  readonly apiClient?: ApiClient;
  readonly initialItems?: readonly LibraryItemViewModel[];
  readonly forcedState?: 'loading' | 'empty' | 'error' | 'success';
  readonly forcedErrorCode?: ApiErrorCode;
}

const tabs: readonly { value: LibraryFilter; label: string }[] = [
  { value: 'all', label: 'Tất cả' },
  { value: 'content', label: 'Bài đọc' },
  { value: 'sentence', label: 'Câu đã lưu' },
  { value: 'concept', label: 'Khái niệm' },
];

function savedLabel(savedAt: string): string {
  const timestamp = new Date(savedAt);
  return Number.isNaN(timestamp.getTime())
    ? savedAt
    : new Intl.DateTimeFormat('vi-VN', { dateStyle: 'medium', timeZone: 'UTC' }).format(timestamp);
}

export function LibraryView({ apiClient, initialItems, forcedState, forcedErrorCode = 'INTERNAL_ERROR' }: LibraryViewProps) {
  const [activeTab, setActiveTab] = useState<LibraryFilter>('all');
  const presentationItems = forcedState ? (initialItems ?? []) : initialItems;
  const library = useLibrary({
    ...(apiClient ? { apiClient } : {}),
    ...(presentationItems ? { initialItems: presentationItems } : {}),
    enabled: !forcedState,
  });
  const status = forcedState ?? library.status;
  const visibleItems = library.items.filter((item) => activeTab === 'all' || item.itemType === activeTab);
  const count = (filter: LibraryFilter) => filter === 'all'
    ? library.items.length
    : library.items.filter((item) => item.itemType === filter).length;

  return (
    <div className="space-y-6 max-w-4xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Content & Sentences
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Thư viện của bạn
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Những nội dung anh đã lưu trên máy chủ để đọc và học lại.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {!forcedState && <Button variant="outline" size="md" onClick={library.retry}>Tải lại thư viện</Button>}
          <Link href="/read">
            <Button variant="primary" size="md" leftIcon={<BookOpen className="w-4 h-4" />}>Đọc bài mới</Button>
          </Link>
        </div>
      </header>

      {status !== 'loading' && status !== 'error' && (
        <div role="tablist" aria-label="Lọc thư viện" className="flex flex-wrap items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
          {tabs.map((tab) => (
            <button key={tab.value} type="button" role="tab" aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${activeTab === tab.value
                ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)]'
                : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'}`}>
              {tab.label} ({count(tab.value)})
            </button>
          ))}
        </div>
      )}

      {library.mutationError && (
        <InlineAlert variant="danger" title="Không thể xóa mục đã lưu">
          Mục này vẫn được giữ nguyên vì máy chủ chưa xác nhận thao tác.
        </InlineAlert>
      )}
      {status === 'loading' && <LoadingState message="Đang tải thư viện từ máy chủ..." count={3} />}
      {status === 'error' && (
        <ErrorState code={library.error?.code ?? forcedErrorCode} title="Không thể tải thư viện"
          description="Danh sách chưa được xác nhận đầy đủ. Vui lòng thử lại." onRetry={library.retry} />
      )}
      {(status === 'empty' || (status === 'success' && visibleItems.length === 0)) && (
        <EmptyState title={forcedState === 'empty'
          ? 'Chưa có bài đọc nào được lưu'
          : library.items.length === 0 ? 'Thư viện đang trống' : 'Không có mục nào trong nhóm này'}
          description="Lưu bài đọc, câu hoặc khái niệm từ Reader và Từ điển để xem lại tại đây."
          actionLabel="Đọc bài trong Reader" onAction={() => { window.location.href = '/read'; }} />
      )}
      {status === 'success' && visibleItems.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4" role="list">
          {visibleItems.map((item) => {
            const key = `${item.itemType}:${item.id}`;
            return (
              <Card key={key} variant="interactive" padding="md" className="space-y-3"
                data-testid="library-item" data-item-type={item.itemType} role="listitem">
                <div className="flex items-start justify-between gap-3">
                  <Badge variant="primary" size="sm">
                    {item.itemType === 'content' ? 'Bài đọc' : item.itemType === 'sentence' ? 'Câu' : 'Khái niệm'}
                  </Badge>
                  <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                    <Bookmark className="w-3.5 h-3.5" /> {savedLabel(item.savedAt)}
                  </span>
                </div>

                {item.itemType === 'concept' && (
                  <div>
                    <h2 className="font-bold text-lg text-[var(--text-primary)]">{item.canonicalForm}</h2>
                    {(item.ipa || item.partOfSpeech) && <p className="text-xs text-[var(--text-muted)] font-mono">{[item.ipa, item.partOfSpeech].filter(Boolean).join(' • ')}</p>}
                    <p className="text-xs text-[var(--text-secondary)] mt-2">{item.level ? `Mức ${item.level} • ` : ''}{item.status}{item.isDue ? ' • Đến hạn ôn' : ''}</p>
                  </div>
                )}
                {item.itemType === 'sentence' && (
                  <div>
                    <p className="font-semibold text-[var(--text-primary)]">{item.text}</p>
                    {item.translation && <p className="text-sm text-[var(--text-secondary)] mt-1">{item.translation}</p>}
                  </div>
                )}
                {item.itemType === 'content' && (
                  <div>
                    <h2 className="font-bold text-base text-[var(--text-primary)]">{item.title}</h2>
                    {item.excerpt && <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{item.excerpt}</p>}
                    <p className="text-xs text-[var(--text-muted)] mt-2 flex items-center gap-1">
                      <Clock className="w-3.5 h-3.5" /> {item.estimatedMinutes} phút • Tỷ lệ từ quen {item.knownConceptPercent}%{item.level ? ` • ${item.level}` : ''}
                    </p>
                    {item.attribution && <p className="text-xs text-[var(--text-muted)] mt-1">{item.attribution.attributionText}</p>}
                  </div>
                )}

                <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                  {item.itemType === 'content'
                    ? <Link className="text-sm font-semibold text-[var(--action-primary)]" href="/read">Mở trong Reader</Link>
                    : <span />}
                  <Button variant="ghost" size="sm" leftIcon={<Trash2 className="w-3.5 h-3.5" />}
                    disabled={library.busyKeys.has(key)} onClick={() => void library.remove(item)}
                    aria-label={`Xóa khỏi thư viện: ${item.itemType === 'concept' ? item.canonicalForm : item.itemType === 'sentence' ? item.text : item.title}`}>
                    Xóa
                  </Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
