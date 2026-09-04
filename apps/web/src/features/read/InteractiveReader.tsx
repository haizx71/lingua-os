'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
} from '@lingua/ui';
import {
  BookOpen,
  Sparkles,
  Volume2,
  Bookmark,
  Check,
  Plus,
  ArrowRight,
  HelpCircle,
  X,
} from 'lucide-react';
import { type ConceptStatus, type ApiErrorCode } from '@lingua/types';
import { defaultReaderPassage, type ReaderPassage, type TokenItem } from '../../fixtures/readerFixture';

export interface InteractiveReaderProps {
  passage?: ReaderPassage;
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  onSaveWord?: (token: TokenItem) => void;
}

export function InteractiveReader({
  passage = defaultReaderPassage,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSaveWord,
}: InteractiveReaderProps) {
  const [selectedToken, setSelectedToken] = useState<TokenItem | null>(null);
  const [savedWords, setSavedWords] = useState<Set<string>>(new Set(['appointment']));
  const [showSavedNotification, setShowSavedNotification] = useState<string | null>(null);
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);

  const handleWordClick = (token: TokenItem) => {
    setSelectedToken(token);
  };

  const handleSaveConcept = (token: TokenItem) => {
    setSavedWords((prev) => new Set(prev).add(token.raw));
    setShowSavedNotification(`Đã lưu "${token.raw}" vào Language Brain để lên lịch ôn FSRS.`);
    onSaveWord?.(token);
  };

  const handlePlayFullAudio = () => {
    setIsPlayingAudio(true);
    setTimeout(() => setIsPlayingAudio(false), 1200);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang tải và phân tích văn bản đọc..." count={3} />;
  }

  if (currentState === 'error') {
    return (
      <ErrorState
        code={errorCode}
        title="Không thể tải bài đọc"
        description="Đã xảy ra lỗi khi kết nối với máy chủ nội dung. Vui lòng thử lại."
        onRetry={() => setCurrentState('success')}
      />
    );
  }

  if (currentState === 'empty' || !passage || passage.sentences.length === 0) {
    return (
      <EmptyState
        title="Chưa có bài đọc nào"
        description="Không tìm thấy bài đọc nào phù hợp với trình độ hiện tại của bạn."
        actionLabel="Khám phá Thư viện bài đọc"
        onAction={() => {
          window.location.href = '/library';
        }}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Reader • Immersion
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Đọc & Tiếp nạp ngôn ngữ
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Đọc hiểu câu trong ngữ cảnh thật. Chạm vào bất kỳ từ nào để tra nghĩa và lưu vào Language Brain.
          </p>
        </div>
        <Link href="/library">
          <Button variant="outline" size="md" leftIcon={<Bookmark className="w-4 h-4" />}>
            Bài đọc đã lưu
          </Button>
        </Link>
      </header>

      {/* Notification if saved */}
      {showSavedNotification && (
        <InlineAlert variant="success" title="Đã lưu từ vựng">
          {showSavedNotification}
        </InlineAlert>
      )}

      {/* Reading Passage Card */}
      <Card variant="default" padding="lg" className="space-y-6">
        {/* Title & Metadata */}
        <div className="flex items-center justify-between border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              {passage.title}
            </h2>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              CEFR {passage.level} • {passage.wordCount} từ • Tỷ lệ từ quen: {passage.familiarityRate}%
            </span>
          </div>
          <Button
            variant="ghost"
            size="icon"
            className="min-h-[44px] min-w-[44px] rounded-full hover:bg-[var(--surface-subtle)]"
            aria-label="Nghe toàn bài"
            onClick={handlePlayFullAudio}
          >
            <Volume2
              className={`w-5 h-5 text-[var(--action-primary)] ${
                isPlayingAudio ? 'animate-pulse' : ''
              }`}
            />
          </Button>
        </div>

        {/* Study Sentence 1 */}
        <div className="text-base sm:text-lg leading-relaxed text-[var(--text-primary)] space-y-3 font-serif sm:font-sans">
          <p className="text-lg sm:text-xl">
            I would like to make an{' '}
            <button
              type="button"
              onClick={() =>
                handleWordClick({
                  raw: 'appointment',
                  lemma: 'appointment',
                  isTarget: true,
                  status: 'mastered',
                  ipa: '/əˈpɔɪnt.mənt/',
                  pos: 'noun',
                  translationVi: 'Cuộc hẹn chính thức (với bác sĩ, đối tác)',
                  explanationEn: 'An arrangement to meet someone at a particular time and place.',
                })
              }
              className="bg-[var(--status-info-bg)] border-b-2 border-[var(--action-primary)] font-semibold px-1 rounded cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              appointment
            </button>{' '}
            with Dr. Watson for tomorrow morning if he is{' '}
            <button
              type="button"
              onClick={() =>
                handleWordClick({
                  raw: 'available',
                  lemma: 'available',
                  isTarget: true,
                  status: 'weak',
                  ipa: '/əˈveɪ.lə.bəl/',
                  pos: 'adjective',
                  translationVi: 'Có sẵn, rảnh rỗi',
                  explanationEn: 'Able to be used or can easily be found / free to meet.',
                })
              }
              className="bg-[var(--status-warning-bg)] border-b-2 border-[var(--status-warning)] font-semibold px-1 rounded cursor-pointer hover:bg-[var(--status-warning-bg)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
            >
              available
            </button>
            .
          </p>
          <p className="text-sm text-[var(--text-secondary)] font-sans italic">
            (Bản dịch: Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian.)
          </p>
        </div>

        {/* Target Concepts Row */}
        <div className="pt-2 flex flex-wrap items-center gap-2 border-t border-[var(--border-subtle)]">
          <span className="text-xs text-[var(--text-muted)] font-medium">
            Từ vựng mục tiêu trong câu:
          </span>
          <ConceptChip status="mastered" term="appointment" size="sm" />
          <ConceptChip status="weak" term="available" size="sm" />
        </div>
      </Card>

      {/* Word Inspector Modal / Drawer when a token is tapped */}
      {selectedToken && (
        <div
          role="dialog"
          aria-label="Chi tiết từ vựng"
          className="fixed inset-x-4 bottom-20 md:bottom-8 md:inset-x-auto md:right-8 md:w-96 z-50 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl animate-fadeIn"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">
                  {selectedToken.raw}
                </h3>
                {selectedToken.status && (
                  <ConceptChip status={selectedToken.status} term={selectedToken.raw} size="sm" />
                )}
              </div>
              {(selectedToken.ipa || selectedToken.pos) && (
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  {[selectedToken.ipa, selectedToken.pos].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => setSelectedToken(null)}
              aria-label="Đóng bảng tra từ"
            >
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-3 text-sm text-[var(--text-secondary)]">
            <p className="font-medium text-[var(--text-primary)]">
              {selectedToken.translationVi}
            </p>
            {selectedToken.explanationEn && (
              <p className="text-xs text-[var(--text-muted)] mt-1">{selectedToken.explanationEn}</p>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            {savedWords.has(selectedToken.raw) ? (
              <Button variant="secondary" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />}>
                Đã lưu vào Brain
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
                onClick={() => handleSaveConcept(selectedToken)}
              >
                Lưu vào ôn tập
              </Button>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
