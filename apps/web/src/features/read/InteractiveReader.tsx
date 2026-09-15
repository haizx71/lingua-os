'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import {
  Button,
  Card,
  ConceptChip,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
} from '@lingua/ui';
import { Bookmark, Check, Plus, Volume2, X } from 'lucide-react';
import { type ApiClient, type ApiErrorCode } from '@lingua/types';
import type { ReaderPassage, TokenItem } from '../../fixtures/readerFixture';
import { useReaderSession } from './useReaderSession';

export interface InteractiveReaderProps {
  readonly apiClient?: ApiClient;
  readonly passage?: ReaderPassage;
  readonly forcedState?: 'loading' | 'empty' | 'error' | 'success';
  readonly forcedErrorCode?: ApiErrorCode;
  readonly onSaveWord?: (token: TokenItem) => void;
}

export function InteractiveReader({
  apiClient,
  passage: initialPassage,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSaveWord,
}: InteractiveReaderProps) {
  const [presentationState, setPresentationState] = useState(forcedState);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [savedWordNotice, setSavedWordNotice] = useState<string | null>(null);
  const reader = useReaderSession({
    ...(apiClient ? { apiClient } : {}),
    ...(initialPassage ? { initialPassage } : {}),
    enabled: presentationState === 'success',
  });

  const status = presentationState === 'success' ? reader.status : presentationState;
  const passage = reader.passage;

  if (status === 'loading') {
    return <LoadingState message="Đang tải bài đọc đã xuất bản..." count={3} />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        code={reader.error?.code ?? forcedErrorCode}
        title="Không thể tải bài đọc"
        description="Không thể kết nối kho nội dung lúc này. Vui lòng thử lại."
        onRetry={() => {
          if (presentationState !== 'success') setPresentationState('success');
          else reader.retry();
        }}
      />
    );
  }

  if (status === 'empty' || !passage || passage.sentences.length === 0) {
    return (
      <EmptyState
        title="Chưa có bài đọc nào"
        description="Chưa có nội dung đã xuất bản phù hợp với hồ sơ học hiện tại."
        actionLabel="Mở Thư viện"
        onAction={() => { window.location.href = '/library'; }}
      />
    );
  }

  const handlePlayFullAudio = () => {
    if (!passage.audioUrl) return;
    setIsPlayingAudio(true);
    window.setTimeout(() => setIsPlayingAudio(false), 1200);
  };

  const selectedToken = reader.selectedToken;

  return (
    <div className="mx-auto w-full max-w-5xl space-y-5 sm:space-y-6">
      <header className="relative overflow-hidden rounded-[28px] border border-[#dfe9f4] bg-gradient-to-br from-[var(--surface-blue)] via-white to-[var(--accent-teal-soft)] p-5 shadow-[var(--shadow-card)] sm:p-7">
        <div className="pointer-events-none absolute -right-16 -top-20 h-48 w-48 rounded-full bg-white/70" />
        <div className="pointer-events-none absolute -bottom-20 left-1/3 h-40 w-40 rounded-full bg-[var(--accent-teal)]/10 blur-2xl" />
        <div className="relative flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
          <div className="max-w-2xl">
            <span className="lingua-kicker text-[var(--action-primary)]">Reader • Immersion</span>
            <h1 className="mt-2 text-2xl font-extrabold tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">
              Đọc & Tiếp nạp ngôn ngữ
            </h1>
            <p className="mt-2 max-w-xl text-sm leading-6 text-[var(--text-secondary)]">
              Đọc trong ngữ cảnh thật. Mở từ được chú thích để tra cứu; chỉ nút Lưu vào ôn tập mới tạo ý định học.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button
              variant={passage.isSaved ? 'secondary' : 'outline'}
              size="md"
              leftIcon={passage.isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
              onClick={() => void reader.saveContent()}
              disabled={passage.isSaved || reader.busyKeys.has(`content:${passage.id}`)}
            >
              {passage.isSaved ? 'Bài đọc đã lưu' : 'Lưu bài đọc'}
            </Button>
            <Link href="/library">
              <Button variant="outline" size="md">Mở Thư viện</Button>
            </Link>
          </div>
        </div>
      </header>

      {reader.actionError && (
        <InlineAlert variant="danger" title={reader.actionError.message}>
          Thao tác chưa được xác nhận. Anh có thể thử lại mà không tạo thêm trạng thái học.
        </InlineAlert>
      )}

      {savedWordNotice && (
        <InlineAlert variant="success" title={savedWordNotice}>
          Từ vựng đã được thêm bằng ý định học rõ ràng của người học.
        </InlineAlert>
      )}

      {passage.progress && (
        <InlineAlert variant={passage.progress.isCompleted ? 'success' : 'info'} title={`Tiến độ ${passage.progress.progressPercent}%`}>
          {passage.progress.isCompleted
            ? 'Bài đọc đã hoàn thành.'
            : `Tiếp tục từ đoạn ${Math.max(1, passage.segments.findIndex((segment) => segment.id === passage.progress?.currentSegmentId) + 1)}`}
        </InlineAlert>
      )}

      <Card variant="default" padding="none" className="overflow-hidden">
        <div className="flex flex-col gap-4 border-b border-[var(--border-subtle)] bg-[var(--surface-warm)]/55 px-5 py-5 sm:flex-row sm:items-center sm:justify-between sm:px-7">
          <div className="min-w-0">
            <div className="lingua-kicker text-[#9b773f]">Current reading</div>
            <h2 className="mt-1 truncate text-xl font-extrabold tracking-[-0.025em] text-[var(--text-primary)] sm:text-2xl">{passage.title}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2 text-xs font-medium text-[var(--text-muted)]">
              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">CEFR {passage.level}</span>
              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">{passage.wordCount} từ</span>
              <span className="rounded-full bg-white px-2.5 py-1 shadow-sm">Từ quen {passage.familiarityRate}%</span>
            </div>
          </div>
          {passage.audioUrl && (
            <Button
              variant="secondary"
              size="icon"
              className="min-h-[44px] min-w-[44px] self-start rounded-2xl sm:self-auto"
              aria-label="Nghe toàn bài"
              onClick={handlePlayFullAudio}
            >
              <Volume2 className={`h-5 w-5 text-[var(--action-primary)] ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </Button>
          )}
        </div>

        <div className="space-y-8 px-5 py-6 sm:px-7 sm:py-8 lg:px-10">
          {passage.segments.map((segment, segmentIndex) => {
            const finalSegment = segmentIndex === passage.segments.length - 1;
            const segmentBusy = reader.busyKeys.has(`segment:${passage.id}:${segment.id}:${finalSegment}`);
            return (
              <section
                key={segment.id}
                id={`reader-segment-${segment.id}`}
                data-testid="reader-segment"
                data-segment-id={segment.id}
                className="scroll-mt-6 space-y-5 rounded-[22px] border border-transparent p-1 sm:p-2"
              >
                {segment.sentences.map((sentence) => {
                  const sentenceSaved = reader.savedSentenceIds.has(sentence.id);
                  const sentenceNumber = passage.sentences.findIndex((item) => item.id === sentence.id) + 1;
                  return (
                    <article
                      key={sentence.id}
                      data-testid="reader-sentence"
                      data-sentence-id={sentence.id}
                      className="space-y-3 rounded-[20px] px-2 py-3 transition-colors hover:bg-[var(--surface-subtle)]/55 sm:px-3"
                    >
                      <p className="text-[1.08rem] font-medium leading-[1.9] tracking-[-0.01em] text-[var(--text-primary)] sm:text-xl sm:leading-[1.85]">
                        {sentence.tokens.map((token, tokenIndex) => token.conceptId ? (
                          <button
                            key={`${sentence.id}:${tokenIndex}`}
                            type="button"
                            onClick={() => void reader.inspectToken(token)}
                            className="mx-0.5 rounded-md border-b-2 border-[var(--accent-teal)] bg-[var(--accent-teal-soft)] px-1 font-semibold text-[var(--text-primary)] transition-colors hover:bg-[#d9f3ec] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                          >
                            {token.raw}
                          </button>
                        ) : (
                          <React.Fragment key={`${sentence.id}:${tokenIndex}`}>{token.raw}</React.Fragment>
                        ))}
                      </p>
                      {sentence.translationVi && (
                        <p className="border-l-2 border-[var(--border-default)] pl-3 text-sm italic leading-6 text-[var(--text-secondary)]">
                          (Bản dịch: {sentence.translationVi})
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
                        <div className="flex flex-wrap items-center gap-2">
                          {sentence.targetConcepts.length > 0 && (
                            <span className="text-xs font-medium text-[var(--text-muted)]">Từ vựng mục tiêu trong câu:</span>
                          )}
                          {sentence.targetConcepts.map((concept) => (
                            <ConceptChip key={`${sentence.id}:${concept.term}`} status={concept.status} term={concept.term} size="sm" />
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                          leftIcon={sentenceSaved ? <Check className="h-3.5 w-3.5" /> : <Bookmark className="h-3.5 w-3.5" />}
                          disabled={sentenceSaved || reader.busyKeys.has(`sentence:${sentence.id}`)}
                          onClick={() => void reader.saveSentence(sentence.id)}
                        >
                          {sentenceSaved ? 'Đã lưu câu' : 'Lưu câu'}
                        </Button>
                      </div>
                    </article>
                  );
                })}
                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-4">
                  <Button
                    variant={finalSegment ? 'primary' : 'outline'}
                    size="sm"
                    disabled={segmentBusy}
                    onClick={() => void reader.completeSegment(segment.id, finalSegment)}
                  >
                    {finalSegment ? 'Hoàn thành bài đọc' : `Đã đọc đoạn ${segmentIndex + 1}`}
                  </Button>
                </div>
              </section>
            );
          })}
        </div>

        {passage.attribution && (
          <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/45 px-5 py-4 text-xs leading-5 text-[var(--text-muted)] sm:px-7">
            <p>{passage.attribution.attributionText}</p>
            <p>{passage.attribution.sourceName} • {passage.attribution.licenseCode}</p>
          </footer>
        )}
      </Card>

      {selectedToken && (
        <div
          role="dialog"
          aria-label="Chi tiết từ vựng"
          className="fixed inset-x-4 bottom-20 z-50 rounded-[24px] border border-[var(--border-subtle)] bg-[var(--surface)] p-5 shadow-[var(--shadow-floating)] animate-fadeIn md:inset-x-auto md:bottom-8 md:right-8 md:w-96"
        >
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{selectedToken.lemma ?? selectedToken.raw}</h3>
                {selectedToken.status && <ConceptChip status={selectedToken.status} term={selectedToken.raw} size="sm" />}
              </div>
              {(selectedToken.ipa || selectedToken.pos) && (
                <p className="mt-1 font-mono text-xs text-[var(--text-muted)]">
                  {[selectedToken.ipa, selectedToken.pos].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={reader.closeInspector} aria-label="Đóng bảng tra từ">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-4 rounded-2xl bg-[var(--surface-subtle)] p-4 text-sm leading-6 text-[var(--text-secondary)]" aria-busy={reader.inspecting}>
            {reader.inspecting && <p className="text-xs text-[var(--text-muted)]">Đang tải chi tiết từ vựng...</p>}
            {selectedToken.translationVi && <p className="font-bold text-[var(--text-primary)]">{selectedToken.translationVi}</p>}
            {selectedToken.explanationEn && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{selectedToken.explanationEn}</p>}
          </div>

          <div className="mt-4 flex justify-end gap-2 border-t border-[var(--border-subtle)] pt-4">
            {selectedToken.conceptId && reader.savedConceptIds.has(selectedToken.conceptId) ? (
              <Button variant="secondary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />} disabled>
                Đã lưu vào Brain
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="h-3.5 w-3.5" />}
                disabled={!selectedToken.conceptId || reader.inspecting || reader.busyKeys.has(`concept:${selectedToken.conceptId}`)}
                onClick={() => void reader.saveConcept(selectedToken).then((saved) => {
                  if (saved) {
                    setSavedWordNotice(`Đã lưu "${selectedToken.raw}" vào Language Brain`);
                    onSaveWord?.(selectedToken);
                  }
                })}
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
