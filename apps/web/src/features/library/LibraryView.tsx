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
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="relative overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-gradient-to-br from-white via-white to-[var(--surface-blue)] px-4 py-5 shadow-[var(--shadow-card)] sm:px-7 sm:py-7">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[var(--accent-teal-soft)]/70 blur-2xl" />
        <div className="relative flex min-w-0 flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="min-w-0 max-w-2xl">
            <div className="lingua-kicker text-[var(--action-primary)]">Content & Sentences</div>
            <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Thư viện của bạn</h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Những nội dung anh đã lưu trên máy chủ để đọc và học lại.</p>
          </div>
          <div className="grid w-full grid-cols-2 gap-2 sm:flex sm:w-auto sm:flex-wrap">
            {!forcedState && <Button className="w-full sm:w-auto" variant="outline" size="md" onClick={library.retry}>Tải lại thư viện</Button>}
            <Link href="/read" className="min-w-0">
              <Button className="w-full sm:w-auto" variant="primary" size="md" leftIcon={<BookOpen className="h-4 w-4" />}>Đọc bài mới</Button>
            </Link>
          </div>
        </div>
      </header>

      {status !== 'loading' && status !== 'error' && (
        <div className="lingua-mobile-scroller -mx-1 flex snap-x gap-2 overflow-x-auto px-1 pb-1 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0" role="tablist" aria-label="Lọc thư viện">
          {tabs.map((tab) => (
            <button
              key={tab.value}
              type="button"
              role="tab"
              aria-selected={activeTab === tab.value}
              onClick={() => setActiveTab(tab.value)}
              className={`min-h-11 shrink-0 snap-start rounded-2xl border px-4 py-2 text-sm font-bold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${activeTab === tab.value
                ? 'border-[var(--action-primary)]/15 bg-[var(--surface-blue)] text-[var(--action-primary)]'
                : 'border-[var(--border-subtle)] bg-white text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'}`}
            >
              {tab.label} <span className="ml-1 text-xs opacity-70">{count(tab.value)}</span>
            </button>
          ))}
        </div>
      )}

      {library.mutationError && (
        <InlineAlert variant="danger" title="Không thể xóa mục đã lưu">Mục này vẫn được giữ nguyên vì máy chủ chưa xác nhận thao tác.</InlineAlert>
      )}
      {status === 'loading' && <LoadingState message="Đang tải thư viện từ máy chủ..." count={3} />}
      {status === 'error' && (
        <ErrorState code={library.error?.code ?? forcedErrorCode} title="Không thể tải thư viện" description="Danh sách chưa được xác nhận đầy đủ. Vui lòng thử lại." retryLabel="Tải lại thư viện" onRetry={library.retry} />
      )}
      {(status === 'empty' || (status === 'success' && visibleItems.length === 0)) && (
        <EmptyState
          title={forcedState === 'empty' ? 'Chưa có bài đọc nào được lưu' : library.items.length === 0 ? 'Thư viện đang trống' : 'Không có mục nào trong nhóm này'}
          description="Lưu bài đọc, câu hoặc khái niệm từ Reader và Từ điển để xem lại tại đây."
          actionLabel="Đọc bài trong Reader"
          onAction={() => { window.location.href = '/read'; }}
        />
      )}

      {status === 'success' && visibleItems.length > 0 && (
        <div className="grid min-w-0 grid-cols-1 gap-3 lg:grid-cols-2" role="list">
          {visibleItems.map((item) => {
            const key = `${item.itemType}:${item.id}`;
            return (
              <Card
                key={key}
                variant="interactive"
                padding="md"
                className="min-w-0 overflow-hidden rounded-[22px] sm:rounded-[24px]"
                data-testid="library-item"
                data-item-type={item.itemType}
                role="listitem"
              >
                <div className="flex min-w-0 items-start justify-between gap-3">
                  <Badge variant="primary" size="sm">{item.itemType === 'content' ? 'Bài đọc' : item.itemType === 'sentence' ? 'Câu' : 'Khái niệm'}</Badge>
                  <span className="flex shrink-0 items-center gap-1 text-[11px] text-[var(--text-muted)] sm:text-xs"><Bookmark className="h-3.5 w-3.5" />{savedLabel(item.savedAt)}</span>
                </div>

                <div className="mt-4 min-w-0">
                  {item.itemType === 'concept' && (
                    <div className="min-w-0">
                      <h2 className="truncate text-lg font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{item.canonicalForm}</h2>
                      {(item.ipa || item.partOfSpeech) && <p className="mt-1 truncate font-mono text-xs text-[var(--text-muted)]">{[item.ipa, item.partOfSpeech].filter(Boolean).join(' • ')}</p>}
                      <p className="mt-3 text-xs leading-5 text-[var(--text-secondary)]">{item.level ? `Mức ${item.level} • ` : ''}{item.status}{item.isDue ? ' • Đến hạn ôn' : ''}</p>
                    </div>
                  )}
                  {item.itemType === 'sentence' && (
                    <div className="min-w-0">
                      <p className="line-clamp-3 font-semibold leading-6 text-[var(--text-primary)]">{item.text}</p>
                      {item.translation && <p className="mt-2 line-clamp-2 text-sm leading-5 text-[var(--text-secondary)]">{item.translation}</p>}
                    </div>
                  )}
                  {item.itemType === 'content' && (
                    <div className="min-w-0">
                      <h2 className="line-clamp-2 text-base font-extrabold leading-6 text-[var(--text-primary)]">{item.title}</h2>
                      {item.excerpt && <p className="mt-1 line-clamp-2 text-xs leading-5 text-[var(--text-secondary)]">{item.excerpt}</p>}
                      <p className="mt-3 flex min-w-0 items-center gap-1 text-xs leading-5 text-[var(--text-muted)]"><Clock className="h-3.5 w-3.5 shrink-0" /><span className="min-w-0">{item.estimatedMinutes} phút • Tỷ lệ từ quen {item.knownConceptPercent}%{item.level ? ` • ${item.level}` : ''}</span></p>
                      {item.attribution && <p className="mt-1 line-clamp-1 text-xs text-[var(--text-muted)]">{item.attribution.attributionText}</p>}
                    </div>
                  )}
                </div>

                <div className="mt-4 flex min-w-0 items-center justify-between gap-2 border-t border-[var(--border-subtle)] pt-3">
                  {item.itemType === 'content'
                    ? <Link className="min-h-11 min-w-0 flex-1 rounded-xl px-2 py-3 text-sm font-bold text-[var(--action-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" href="/read">Mở trong Reader</Link>
                    : <span className="flex-1" />}
                  <Button
                    variant="ghost"
                    size="sm"
                    leftIcon={<Trash2 className="h-3.5 w-3.5" />}
                    disabled={library.busyKeys.has(key)}
                    onClick={() => void library.remove(item)}
                    aria-label={`Xóa khỏi thư viện: ${item.itemType === 'concept' ? item.canonicalForm : item.itemType === 'sentence' ? item.text : item.title}`}
                  >Xóa</Button>
                </div>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
