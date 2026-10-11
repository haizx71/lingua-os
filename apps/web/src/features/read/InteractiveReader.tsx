'use client';

import React, { useEffect, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import {
  Button,
  ConceptChip,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
  Progress,
  conceptStateMetadata,
} from '@lingua/ui';
import { Bookmark, Check, Languages, Plus, Volume2, X } from 'lucide-react';
import { MockApiClient, type ApiClient, type ApiErrorCode } from '@lingua/types';
import type { ReaderPassage, TokenItem } from '../../fixtures/readerFixture';
import { useReaderSession } from './useReaderSession';
import { getApiClient } from '../../lib/api/client';

export interface InteractiveReaderProps {
  readonly apiClient?: ApiClient;
  readonly passage?: ReaderPassage;
  readonly requestedContentId?: string | null;
  readonly forcedState?: 'loading' | 'empty' | 'error' | 'success';
  readonly forcedErrorCode?: ApiErrorCode;
  readonly onSaveWord?: (token: TokenItem) => void;
}

export function InteractiveReader({
  apiClient,
  passage: initialPassage,
  requestedContentId,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  onSaveWord,
}: InteractiveReaderProps) {
  const [presentationState, setPresentationState] = useState(forcedState);
  const [isPlayingAudio, setIsPlayingAudio] = useState(false);
  const [savedWordNotice, setSavedWordNotice] = useState<string | null>(null);
  const [revealedSentenceIds, setRevealedSentenceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [usesSampleTransport, setUsesSampleTransport] = useState(false);
  const lastNotifiedSaveRef = useRef<string | null>(null);
  const inspectorCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorWasOpenRef = useRef(false);
  const isSamplePassage = Boolean(initialPassage) || usesSampleTransport;
  const isExplicitSample = Boolean(initialPassage);
  const reader = useReaderSession({
    ...(apiClient ? { apiClient } : {}),
    ...(initialPassage ? { initialPassage } : {}),
    ...(requestedContentId !== undefined ? { requestedContentId } : {}),
    enabled: presentationState === 'success',
  });

  const status = presentationState === 'success' ? reader.status : presentationState;
  const passage = reader.passage;

  useEffect(() => {
    setRevealedSentenceIds(new Set());
    setSavedWordNotice(null);
    lastNotifiedSaveRef.current = null;
  }, [passage?.id]);

  useEffect(() => {
    const token = reader.selectedToken;
    if (!passage || !token?.conceptId || !reader.savedConceptIds.has(token.conceptId)) return;
    const noticeIdentity = `${passage.id}:${token.conceptId}`;
    if (lastNotifiedSaveRef.current === noticeIdentity) return;
    lastNotifiedSaveRef.current = noticeIdentity;
    setSavedWordNotice(`Đã lưu “${token.raw}” để học`);
    onSaveWord?.(token);
  }, [onSaveWord, passage, reader.savedConceptIds, reader.selectedToken]);

  useEffect(() => {
    if (!initialPassage) setUsesSampleTransport((apiClient ?? getApiClient()) instanceof MockApiClient);
  }, [apiClient, initialPassage]);

  useEffect(() => {
    if (!reader.selectedToken) {
      if (inspectorWasOpenRef.current) {
        inspectorWasOpenRef.current = false;
        inspectorTriggerRef.current?.focus({ preventScroll: true });
      }
      return;
    }

    if (!inspectorWasOpenRef.current) {
      inspectorCloseButtonRef.current?.focus({ preventScroll: true });
      inspectorWasOpenRef.current = true;
    }

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        reader.closeInspector();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [reader.selectedToken, reader.closeInspector]);

  if (status === 'loading') {
    return <LoadingState message="Đang tải bài đọc đã xuất bản..." count={3} />;
  }

  if (status === 'error') {
    return (
      <ErrorState
        code={reader.error?.code ?? forcedErrorCode}
        title="Không thể tải bài đọc"
        description={requestedContentId !== undefined
          ? 'Bài đọc này không khả dụng hoặc không thể tải lúc này. Vui lòng thử lại.'
          : 'Không thể kết nối kho nội dung lúc này. Vui lòng thử lại.'}
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
  const selectedSentence = selectedToken?.sentenceId
    ? passage.sentences.find((sentence) => sentence.id === selectedToken.sentenceId)
    : undefined;
  const currentSegmentIndex = passage.progress
    ? passage.segments.findIndex((segment) => segment.id === passage.progress?.currentSegmentId)
    : -1;

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2 sm:space-y-4">
      <header className="flex min-w-0 items-center gap-3 px-1 sm:gap-5">
        <div className="min-w-0 flex-1">
          {isExplicitSample && <p className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">Bản xem trước · dữ liệu mẫu</p>}
          <p className="lingua-kicker text-[var(--action-primary)]">
            CEFR {passage.level} · {passage.wordCount} từ{!isSamplePassage ? ` · ${passage.familiarityRate}% từ quen` : ''}
          </p>
          <h1 className="mt-1 max-w-[13ch] text-[26px] font-bold leading-[1.08] tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">{passage.title}</h1>
        </div>
        <Image src="/assets/reader-tea-book.png" alt="" aria-hidden="true" width={270} height={190} className="h-auto w-[34%] max-w-[175px] shrink-0 object-contain" />
      </header>

      <p role="note" className="rounded-xl bg-[var(--surface-subtle)] px-3 py-2 text-sm leading-5 text-[var(--text-secondary)]">
        Chạm từ được gạch chân để xem nghĩa tiếng Việt; từ trong danh mục có thể lưu để học. Lưu câu hoặc bài chỉ là dấu trang.
      </p>

      {passage.progress && (
        <div className="flex min-w-0 items-center gap-3 px-1">
          <Progress
            value={passage.progress.progressPercent}
            max={100}
            label={`Tiến độ bài đọc: ${passage.progress.progressPercent}%`}
            showValueText={false}
            size="sm"
            className="flex-1 [&>div:first-child]:sr-only"
          />
          {currentSegmentIndex >= 0 && (
            <span className="shrink-0 text-xs text-[var(--text-muted)]">
              Đoạn {currentSegmentIndex + 1} / {passage.segments.length}
            </span>
          )}
        </div>
      )}

      <div className="flex flex-wrap items-center gap-1 px-1">
        {passage.audioUrl && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Volume2 className="h-4 w-4" />}
            onClick={handlePlayFullAudio}
            aria-label="Nghe toàn bài"
          >
            {isPlayingAudio ? 'Đang phát' : 'Nghe bài'}
          </Button>
        )}
        <Button
          variant={passage.isSaved ? 'secondary' : 'outline'}
          size="sm"
          leftIcon={passage.isSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
          onClick={() => void reader.saveContent()}
          disabled={passage.isSaved || reader.busyKeys.has(`content:${passage.id}`)}
        >
          {passage.isSaved ? 'Đã lưu bài đọc' : 'Lưu bài đọc'}
        </Button>
        <Link href="/library" className="min-w-0"><Button variant="ghost" size="sm">Thư viện</Button></Link>
      </div>

      {reader.actionError && (
        <InlineAlert variant="danger" title={reader.actionError.message}>
          Thao tác chưa hoàn tất. Vui lòng thử lại.
        </InlineAlert>
      )}

      {savedWordNotice && (
        <InlineAlert variant="success" title={savedWordNotice}>
          <Link
            href="/review"
            prefetch={false}
            className="inline-flex min-h-11 items-center rounded-lg font-semibold text-[var(--action-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
          >
            Xem từ đến hạn ôn
          </Link>
        </InlineAlert>
      )}

      <div className="min-w-0">
        <div className="space-y-3 px-1 sm:space-y-5 sm:px-2">
          {passage.segments.map((segment, segmentIndex) => {
            const finalSegment = segmentIndex === passage.segments.length - 1;
            const segmentBusy = reader.busyKeys.has(`segment:${passage.id}:${segment.id}:${finalSegment}`);
            return (
              <section
                key={segment.id}
                id={`reader-segment-${segment.id}`}
                data-testid="reader-segment"
                data-segment-id={segment.id}
                className="min-w-0 scroll-mt-6 space-y-3"
              >
                {segment.sentences.map((sentence) => {
                  const sentenceSaved = reader.savedSentenceIds.has(sentence.id);
                  const hasTranslation = Boolean(sentence.translationVi?.trim());
                  const meaningIsRevealed = revealedSentenceIds.has(sentence.id);
                  const sentenceNumber = passage.sentences.findIndex((item) => item.id === sentence.id) + 1;
                  return (
                    <article
                      key={sentence.id}
                      data-testid="reader-sentence"
                      data-sentence-id={sentence.id}
                      className="min-w-0 space-y-1.5 py-1"
                    >
                      <p className="reader-copy break-words text-[1.18rem] text-[var(--text-primary)] sm:text-[1.3rem]">
                        {sentence.tokens.map((token, tokenIndex) => token.conceptId || token.isLookupable ? (
                          <React.Fragment key={`${sentence.id}:${tokenIndex}`}>
                            <button
                              type="button"
                              aria-describedby={token.status ? `reader-token-status-${sentence.id}-${tokenIndex}` : undefined}
                              onClick={(event) => {
                                inspectorTriggerRef.current = event.currentTarget;
                                if (token.conceptId) void reader.inspectToken(token);
                                else void reader.lookupToken(token);
                              }}
                              className={token.conceptId
                                ? 'mx-0.5 inline break-words rounded-md border-b-2 border-[var(--action-primary)]/55 bg-[var(--surface-lilac)] px-1 font-semibold text-[var(--text-primary)] transition-colors hover:bg-[var(--action-secondary)] focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)]'
                                : 'mx-0.5 inline break-words border-b border-dotted border-[var(--action-primary)]/45 text-inherit transition-colors hover:border-[var(--action-primary)] hover:text-[var(--action-primary)] focus-visible:rounded-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]'}
                            >
                              {token.raw}
                            </button>
                            {token.status && <span id={`reader-token-status-${sentence.id}-${tokenIndex}`} className="sr-only">{conceptStateMetadata[token.status].labelVi}: {conceptStateMetadata[token.status].descriptionVi}</span>}
                          </React.Fragment>
                        ) : (
                          <React.Fragment key={`${sentence.id}:${tokenIndex}`}>{token.raw}</React.Fragment>
                        ))}
                      </p>
                      <div className="space-y-1">
                        <div className="flex min-w-0 items-center justify-between gap-2">
                          {hasTranslation ? (
                            <button
                              type="button"
                              className="inline-flex min-h-11 items-center gap-2 rounded-xl px-2 text-sm font-semibold text-[var(--action-primary)] hover:bg-[var(--surface-lilac)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
                              aria-expanded={meaningIsRevealed}
                              aria-controls={`reader-translation-${sentence.id}`}
                              onClick={() => setRevealedSentenceIds((previous) => {
                                const next = new Set(previous);
                                if (next.has(sentence.id)) next.delete(sentence.id);
                                else next.add(sentence.id);
                                return next;
                              })}
                            >
                              <Languages className="h-4 w-4" aria-hidden="true" />
                              {meaningIsRevealed ? 'Ẩn nghĩa câu' : 'Xem nghĩa câu'}
                            </button>
                          ) : <span aria-hidden="true" />}
                          <Button
                            variant="ghost"
                            size="icon"
                            aria-label={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                            title={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                            leftIcon={sentenceSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                            disabled={sentenceSaved || reader.busyKeys.has(`sentence:${sentence.id}`)}
                            onClick={() => void reader.saveSentence(sentence.id)}
                          />
                        </div>
                        {hasTranslation && meaningIsRevealed && <p id={`reader-translation-${sentence.id}`} className="reader-copy border-l-2 border-[var(--border-default)] pl-3 text-sm text-[var(--text-secondary)]">{sentence.translationVi}</p>}
                      </div>
                    </article>
                  );
                })}
                <div className="flex justify-stretch border-t border-[var(--border-subtle)] pt-4 sm:justify-end">
                  <Button
                    variant={finalSegment ? 'primary' : 'outline'}
                    size="sm"
                    className="w-full sm:w-auto"
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

        {passage.progress?.isCompleted && (
          <div className="mt-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 px-4 py-3">
            <p className="text-sm text-[var(--text-secondary)]">Bài đọc đã hoàn thành. Bạn có thể xem hoạt động trong kế hoạch hôm nay.</p>
            <Link
              href="/today"
              prefetch={false}
              className="inline-flex min-h-11 items-center rounded-lg font-semibold text-[var(--action-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
            >
              Xem kế hoạch hôm nay
            </Link>
          </div>
        )}

        {passage.attribution && (
          <footer className="border-t border-[var(--border-subtle)] bg-[var(--surface-subtle)]/45 px-4 py-4 text-xs leading-5 text-[var(--text-muted)] sm:px-7">
            <p>{passage.attribution.attributionText}</p>
            <p>{passage.attribution.sourceName} • {passage.attribution.licenseCode}</p>
          </footer>
        )}
      </div>

      {selectedToken && (
        <div
          role="dialog"
          aria-label="Chi tiết từ vựng"
          className="fixed inset-x-3 bottom-[calc(5.75rem+env(safe-area-inset-bottom))] z-50 max-h-[48dvh] overflow-y-auto rounded-[22px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-floating)] animate-fadeIn sm:inset-x-4 sm:p-4 md:inset-x-auto md:bottom-8 md:max-h-[80vh] md:w-96 md:rounded-[24px]"
        >
          <div className="flex min-w-0 items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[11px] font-semibold text-[var(--text-muted)]">Tra từ</p>
              <h3 className="break-words text-lg font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{selectedToken.lemma ?? selectedToken.raw}</h3>
              {selectedToken.status && <ConceptChip status={selectedToken.status} size="sm" />}
            </div>
            <Button ref={inspectorCloseButtonRef} variant="ghost" size="icon" onClick={reader.closeInspector} aria-label="Đóng bảng tra từ">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 rounded-2xl bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-5 text-[var(--text-secondary)]" aria-busy={reader.inspecting}>
            {reader.inspecting && <p className="text-xs text-[var(--text-muted)]">Đang tải nghĩa từ...</p>}
            {selectedToken.conceptId && selectedSentence?.translationVi.trim() && (
              <div className="mb-2 border-b border-[var(--border-subtle)] pb-2">
                <p className="mb-0.5 text-[10px] font-semibold text-[var(--text-muted)]">Nghĩa câu</p>
                <p className="reader-copy text-sm leading-5 text-[var(--text-primary)]">{selectedSentence.translationVi}</p>
              </div>
            )}
            {selectedToken.translationVi && (
              <div className="flex min-w-0 items-baseline gap-2">
                <span className="shrink-0 text-[10px] font-semibold text-[var(--text-muted)]">Nghĩa từ</span>
                <p className="min-w-0 break-words font-bold text-[var(--text-primary)]">{selectedToken.translationVi}</p>
              </div>
            )}
            {(selectedToken.ipa || selectedToken.pos) && (
              <p className="mt-1 break-words font-mono text-[10px] text-[var(--text-muted)]">
                {[selectedToken.ipa, selectedToken.pos].filter(Boolean).join(' · ')}
              </p>
            )}
            {selectedToken.explanationEn && <details className="mt-1 text-xs text-[var(--text-muted)]"><summary className="cursor-pointer">Định nghĩa tiếng Anh</summary><p className="mt-1 leading-4">{selectedToken.explanationEn}</p></details>}
            {selectedToken.isLookupable && reader.lookupStatus === 'found' && reader.lookupResult && (
              <div className="mt-2 space-y-3">
                {reader.lookupResult.entries.map((entry, entryIndex) => (
                  <section key={`${entry.matchedSurface}:${entryIndex}`} className="space-y-2 border-t border-[var(--border-subtle)] pt-2">
                    {(entry.partOfSpeech || entry.formOf) && (
                      <p className="text-xs font-semibold text-[var(--text-muted)]">
                        {[entry.partOfSpeech, entry.formOf ? `dạng của ${entry.formOf}` : undefined].filter(Boolean).join(' · ')}
                      </p>
                    )}
                    <ol className="list-decimal space-y-1 pl-5">
                      {entry.senses.map((sense) => (
                        <li key={sense.senseOrder} className="break-words font-semibold text-[var(--text-primary)]">{sense.glossVi}</li>
                      ))}
                    </ol>
                    {entry.attributions.map((attribution, attributionIndex) => (
                      <div key={`${attribution.sourceUrl}:${attributionIndex}`} className="space-y-0.5 text-[11px] leading-4 text-[var(--text-muted)]">
                        <p>
                          <a href={attribution.sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{attribution.sourceName}</a>
                          {' · '}
                          <a href={attribution.licenseUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">{attribution.licenseCode}</a>
                        </p>
                        <p>{attribution.attributionText}</p>
                        {attribution.changeNotice && <p>{attribution.changeNotice}</p>}
                      </div>
                    ))}
                  </section>
                ))}
              </div>
            )}
            {selectedToken.isLookupable && reader.lookupStatus === 'not_found' && (
              <p className="text-sm text-[var(--text-secondary)]">Chưa có nghĩa tiếng Việt đã duyệt cho từ này.</p>
            )}
            {selectedToken.isLookupable && reader.lookupStatus === 'timeout' && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">Tra từ quá thời gian chờ.</p>
                <button type="button" onClick={() => void reader.retryLookup()} className="min-h-11 rounded-lg px-2 font-semibold text-[var(--action-primary)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Thử tra lại</button>
              </div>
            )}
            {selectedToken.isLookupable && reader.lookupStatus === 'error' && (
              <div className="space-y-2">
                <p className="text-sm text-[var(--text-secondary)]">Không thể tải nghĩa từ này lúc này.</p>
                <button type="button" onClick={() => void reader.retryLookup()} className="min-h-11 rounded-lg px-2 font-semibold text-[var(--action-primary)] underline underline-offset-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]">Thử tra lại</button>
              </div>
            )}
          </div>

          {selectedToken.conceptId && <div className="mt-2 flex justify-end border-t border-[var(--border-subtle)] pt-2">
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
                onClick={() => void reader.saveConcept(selectedToken)}
              >
                Lưu vào ôn tập
              </Button>
            )}
          </div>}
        </div>
      )}
    </div>
  );
}
