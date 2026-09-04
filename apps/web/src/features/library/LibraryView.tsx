'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Card,
  Badge,
  Button,
  EmptyState,
  LoadingState,
  ErrorState,
} from '@lingua/ui';
import { Library, BookOpen, Clock, ArrowRight, Bookmark, CheckCircle2 } from 'lucide-react';
import { type ApiErrorCode } from '@lingua/types';

export interface LibraryArticleItem {
  id: string;
  title: string;
  excerpt: string;
  level: string;
  wordCount: number;
  knownRatio: number;
  durationMinutes: number;
  readCount: number;
}

export interface LibraryViewProps {
  initialArticles?: LibraryArticleItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function LibraryView({
  initialArticles = [],
  forcedState = 'empty',
  forcedErrorCode = 'INTERNAL_ERROR',
}: LibraryViewProps) {
  const [articles, setArticles] = useState<LibraryArticleItem[]>(initialArticles);
  const [selectedLevel, setSelectedLevel] = useState<string>('ALL');
  const [activeTab, setActiveTab] = useState<'articles' | 'sentences'>('articles');
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(
    initialArticles.length > 0 ? 'success' : forcedState
  );
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => {
      setCurrentState('empty');
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang tải danh sách bài đọc trong thư viện..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Content & Sentences
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Thư viện của bạn
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Kho lưu trữ bài đọc, câu văn khai phá và nội dung đã học.
          </p>
        </div>
        <Link href="/read">
          <Button variant="primary" size="md" leftIcon={<BookOpen className="w-4 h-4" />}>
            Đọc bài mới
          </Button>
        </Link>
      </header>

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[var(--border-subtle)] pb-2">
        <button
          type="button"
          onClick={() => setActiveTab('articles')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'articles'
              ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
          }`}
        >
          Bài đọc ({articles.length})
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('sentences')}
          className={`px-4 py-2 rounded-xl text-sm font-semibold transition-colors ${
            activeTab === 'sentences'
              ? 'bg-[var(--status-info-bg)] text-[var(--action-primary)]'
              : 'text-[var(--text-secondary)] hover:bg-[var(--surface-subtle)]'
          }`}
        >
          Câu đã lưu (14)
        </button>
      </div>

      {/* Content Area */}
      {articles.length === 0 ? (
        <EmptyState
          title="Chưa có bài đọc nào được lưu"
          description="Khám phá các bài đọc trong Reader và đánh dấu lưu bài để đọc lại sau."
          actionLabel="Đọc bài trong Reader"
          onAction={() => {
            window.location.href = '/read';
          }}
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {articles.map((art) => (
            <Card key={art.id} variant="interactive" padding="md" className="space-y-3">
              <div className="flex justify-between items-start">
                <Badge variant="primary" size="sm">
                  CEFR {art.level}
                </Badge>
                <span className="text-xs text-[var(--text-muted)] flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5" />
                  {art.durationMinutes} phút
                </span>
              </div>
              <div>
                <h3 className="font-bold text-base text-[var(--text-primary)]">{art.title}</h3>
                <p className="text-xs text-[var(--text-secondary)] mt-1 line-clamp-2">{art.excerpt}</p>
              </div>
              <div className="pt-2 border-t border-[var(--border-subtle)] flex items-center justify-between">
                <span className="text-xs text-[var(--text-muted)]">Tỷ lệ từ quen: {art.knownRatio}%</span>
                <Link href={`/read?id=${art.id}`}>
                  <Button variant="ghost" size="sm" rightIcon={<ArrowRight className="w-3.5 h-3.5" />}>
                    Đọc
                  </Button>
                </Link>
              </div>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
