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
    <div className="space-y-6 max-w-4xl">
      <header className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
            Reader • Immersion
          </span>
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
            Đọc & Tiếp nạp ngôn ngữ
          </h1>
          <p className="text-sm text-[var(--text-secondary)] mt-1">
            Đọc trong ngữ cảnh thật. Mở từ được chú thích để tra cứu; chỉ nút Lưu vào ôn tập mới tạo ý định học.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button
            variant={passage.isSaved ? 'secondary' : 'outline'}
            size="md"
            leftIcon={passage.isSaved ? <Check className="w-4 h-4" /> : <Bookmark className="w-4 h-4" />}
            onClick={() => void reader.saveContent()}
            disabled={passage.isSaved || reader.busyKeys.has(`content:${passage.id}`)}
          >
            {passage.isSaved ? 'Bài đọc đã lưu' : 'Lưu bài đọc'}
          </Button>
          <Link href="/library">
            <Button variant="outline" size="md">Mở Thư viện</Button>
          </Link>
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

      <Card variant="default" padding="lg" className="space-y-6">
        <div className="flex items-center justify-between gap-4 border-b border-[var(--border-subtle)] pb-4">
          <div>
            <h2 className="text-xl font-bold text-[var(--text-primary)]">{passage.title}</h2>
            <span className="text-xs text-[var(--text-muted)] font-medium">
              CEFR {passage.level} • {passage.wordCount} từ • Tỷ lệ từ quen: {passage.familiarityRate}%
            </span>
          </div>
          {passage.audioUrl && (
            <Button
              variant="ghost"
              size="icon"
              className="min-h-[44px] min-w-[44px] rounded-full hover:bg-[var(--surface-subtle)]"
              aria-label="Nghe toàn bài"
              onClick={handlePlayFullAudio}
            >
              <Volume2 className={`w-5 h-5 text-[var(--action-primary)] ${isPlayingAudio ? 'animate-pulse' : ''}`} />
            </Button>
          )}
        </div>

        <div className="space-y-8">
          {passage.segments.map((segment, segmentIndex) => {
            const finalSegment = segmentIndex === passage.segments.length - 1;
            const segmentBusy = reader.busyKeys.has(`segment:${passage.id}:${segment.id}:${finalSegment}`);
            return (
              <section
                key={segment.id}
                id={`reader-segment-${segment.id}`}
                data-testid="reader-segment"
                data-segment-id={segment.id}
                className="space-y-4 scroll-mt-6"
              >
                {segment.sentences.map((sentence) => {
                  const sentenceSaved = reader.savedSentenceIds.has(sentence.id);
                  const sentenceNumber = passage.sentences.findIndex((item) => item.id === sentence.id) + 1;
                  return (
                    <article
                      key={sentence.id}
                      data-testid="reader-sentence"
                      data-sentence-id={sentence.id}
                      className="space-y-3"
                    >
                      <p className="text-lg sm:text-xl leading-relaxed text-[var(--text-primary)] font-serif sm:font-sans">
                        {sentence.tokens.map((token, tokenIndex) => token.conceptId ? (
                          <button
                            key={`${sentence.id}:${tokenIndex}`}
                            type="button"
                            onClick={() => void reader.inspectToken(token)}
                            className="bg-[var(--status-info-bg)] border-b-2 border-[var(--action-primary)] font-semibold px-1 rounded cursor-pointer hover:bg-[var(--surface-subtle)] transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]"
                          >
                            {token.raw}
                          </button>
                        ) : (
                          <React.Fragment key={`${sentence.id}:${tokenIndex}`}>{token.raw}</React.Fragment>
                        ))}
                      </p>
                      {sentence.translationVi && (
                        <p className="text-sm text-[var(--text-secondary)] font-sans italic">
                          (Bản dịch: {sentence.translationVi})
                        </p>
                      )}
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <div className="flex flex-wrap items-center gap-2">
                          {sentence.targetConcepts.length > 0 && (
                            <span className="text-xs text-[var(--text-muted)] font-medium">Từ vựng mục tiêu trong câu:</span>
                          )}
                          {sentence.targetConcepts.map((concept) => (
                            <ConceptChip key={`${sentence.id}:${concept.term}`} status={concept.status} term={concept.term} size="sm" />
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="sm"
                          aria-label={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                          leftIcon={sentenceSaved ? <Check className="w-3.5 h-3.5" /> : <Bookmark className="w-3.5 h-3.5" />}
                          disabled={sentenceSaved || reader.busyKeys.has(`sentence:${sentence.id}`)}
                          onClick={() => void reader.saveSentence(sentence.id)}
                        >
                          {sentenceSaved ? 'Đã lưu câu' : 'Lưu câu'}
                        </Button>
                      </div>
                    </article>
                  );
                })}
                <div className="flex justify-end border-t border-[var(--border-subtle)] pt-3">
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
          <footer className="border-t border-[var(--border-subtle)] pt-4 text-xs text-[var(--text-muted)]">
            <p>{passage.attribution.attributionText}</p>
            <p>{passage.attribution.sourceName} • {passage.attribution.licenseCode}</p>
          </footer>
        )}
      </Card>

      {selectedToken && (
        <div
          role="dialog"
          aria-label="Chi tiết từ vựng"
          className="fixed inset-x-4 bottom-20 md:bottom-8 md:inset-x-auto md:right-8 md:w-96 z-50 p-5 rounded-2xl bg-[var(--surface)] border border-[var(--border-subtle)] shadow-xl animate-fadeIn"
        >
          <div className="flex justify-between items-start">
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-lg font-bold text-[var(--text-primary)]">{selectedToken.lemma ?? selectedToken.raw}</h3>
                {selectedToken.status && <ConceptChip status={selectedToken.status} term={selectedToken.raw} size="sm" />}
              </div>
              {(selectedToken.ipa || selectedToken.pos) && (
                <p className="text-xs text-[var(--text-muted)] font-mono mt-0.5">
                  {[selectedToken.ipa, selectedToken.pos].filter(Boolean).join(' • ')}
                </p>
              )}
            </div>
            <Button variant="ghost" size="icon" onClick={reader.closeInspector} aria-label="Đóng bảng tra từ">
              <X className="w-4 h-4" />
            </Button>
          </div>

          <div className="mt-3 text-sm text-[var(--text-secondary)]" aria-busy={reader.inspecting}>
            {reader.inspecting && <p className="text-xs text-[var(--text-muted)]">Đang tải chi tiết từ vựng...</p>}
            {selectedToken.translationVi && <p className="font-medium text-[var(--text-primary)]">{selectedToken.translationVi}</p>}
            {selectedToken.explanationEn && <p className="text-xs text-[var(--text-muted)] mt-1">{selectedToken.explanationEn}</p>}
          </div>

          <div className="mt-4 pt-3 border-t border-[var(--border-subtle)] flex justify-end gap-2">
            {selectedToken.conceptId && reader.savedConceptIds.has(selectedToken.conceptId) ? (
              <Button variant="secondary" size="sm" leftIcon={<Check className="w-3.5 h-3.5" />} disabled>
                Đã lưu vào Brain
              </Button>
            ) : (
              <Button
                variant="primary"
                size="sm"
                leftIcon={<Plus className="w-3.5 h-3.5" />}
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
