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
import {
  lookupBeginnerWord,
  formatBeginnerPosVi,
  getVietnamesePronunciationTip,
  getSentenceStructureTip,
} from './beginnerLexicon';
import { getApiClient } from '../../lib/api/client';
import { clientNavigate } from '../../lib/navigation/clientNavigate';

export interface InteractiveReaderProps {
  readonly apiClient?: ApiClient;
  readonly passage?: ReaderPassage;
  readonly requestedContentId?: string | null;
  readonly forcedState?: 'loading' | 'empty' | 'error' | 'success';
  readonly forcedErrorCode?: ApiErrorCode;
  readonly onSaveWord?: (token: TokenItem) => void;
}

function getConceptTokenHighlightClass(status?: TokenItem['status']): string {
  switch (status as string | undefined) {
    case 'mastered':
      return 'border-emerald-500/50 bg-emerald-500/12 text-[var(--text-primary)] hover:bg-emerald-500/20';
    case 'learning':
    case 'reviewing':
      return 'border-amber-500/60 bg-amber-500/15 text-[var(--text-primary)] hover:bg-amber-500/25';
    case 'weak':
    case 'forgotten':
      return 'border-rose-500/60 bg-rose-500/15 text-[var(--text-primary)] hover:bg-rose-500/25';
    default:
      return 'border-[var(--action-primary)]/55 bg-[var(--surface-lilac)] text-[var(--text-primary)] hover:bg-[var(--action-secondary)]';
  }
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
  const [playingSentenceId, setPlayingSentenceId] = useState<string | null>(null);
  const [speechRate, setSpeechRate] = useState<1 | 0.75>(() => {
    if (typeof window !== 'undefined') {
      try {
        const raw = window.localStorage.getItem('lingua-user-settings-v1');
        if (raw) {
          const parsed = JSON.parse(raw);
          if (parsed?.defaultSpeechRate === 0.75) return 0.75;
        }
      } catch {
        // Fallback to default
      }
    }
    return 1;
  });
  const [quickLookupToken, setQuickLookupToken] = useState<TokenItem | null>(null);
  const fullAudioTimerRef = useRef<number | null>(null);
  const [savedWordNotice, setSavedWordNotice] = useState<string | null>(null);
  const [revealedSentenceIds, setRevealedSentenceIds] = useState<ReadonlySet<string>>(() => new Set());
  const [revealedRecallIds, setRevealedRecallIds] = useState<Set<string>>(() => new Set());
  const [usesSampleTransport, setUsesSampleTransport] = useState(false);
  const lastNotifiedSaveRef = useRef<string | null>(null);
  const inspectorCloseButtonRef = useRef<HTMLButtonElement | null>(null);
  const inspectorTriggerRef = useRef<HTMLButtonElement | null>(null);
  const inspectorWasOpenRef = useRef(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    try {
      const raw = window.localStorage.getItem('lingua-user-settings-v1');
      if (raw) {
        const parsed = JSON.parse(raw);
        if (parsed?.defaultSpeechRate === 0.75) {
          setSpeechRate(0.75);
        }
      }
    } catch {
      // Ignore localStorage read errors
    }
  }, []);

  useEffect(() => {
    return () => {
      if (fullAudioTimerRef.current) {
        window.clearTimeout(fullAudioTimerRef.current);
      }
    };
  }, []);
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

  const activeToken = reader.selectedToken ?? quickLookupToken;
  const closeActiveInspector = React.useCallback(() => {
    setQuickLookupToken(null);
    reader.closeInspector();
  }, [reader.closeInspector]);

  const recallConcepts = React.useMemo(() => {
    const seen = new Set<string>();
    const list: TokenItem[] = [];
    for (const s of passage?.sentences ?? []) {
      for (const t of s.tokens) {
        if (t.conceptId && !seen.has(t.conceptId)) {
          seen.add(t.conceptId);
          list.push(t);
          if (list.length >= 3) return list;
        }
      }
    }
    return list;
  }, [passage]);

  useEffect(() => {
    setRevealedSentenceIds(new Set());
    setRevealedRecallIds(new Set());
    setSavedWordNotice(null);
    setQuickLookupToken(null);
    lastNotifiedSaveRef.current = null;
  }, [passage?.id]);

  useEffect(() => {
    if (reader.selectedToken) {
      setQuickLookupToken(null);
    }
  }, [reader.selectedToken]);

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
    if (!activeToken) {
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
        closeActiveInspector();
      }
    };
    document.addEventListener('keydown', closeOnEscape);
    return () => document.removeEventListener('keydown', closeOnEscape);
  }, [activeToken, closeActiveInspector]);

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
        onAction={() => { clientNavigate('/library'); }}
      />
    );
  }

  const handlePlayFullAudio = () => {
    if (isPlayingAudio) {
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        try {
          window.speechSynthesis.cancel();
        } catch {
          // Fallback if speechSynthesis is unavailable
        }
      }
      if (fullAudioTimerRef.current) {
        window.clearTimeout(fullAudioTimerRef.current);
      }
      setIsPlayingAudio(false);
      return;
    }

    setIsPlayingAudio(true);
    const fullText = passage.sentences.map((s) => s.tokens.map((t) => t.raw).join('')).join(' ');
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function' &&
      fullText.trim()
    ) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(fullText);
        utterance.lang = 'en-US';
        utterance.rate = speechRate;
        utterance.onend = () => setIsPlayingAudio(false);
        utterance.onerror = () => setIsPlayingAudio(false);
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback for environments where speech synthesis is disabled or blocked
      }
    }
    fullAudioTimerRef.current = window.setTimeout(() => setIsPlayingAudio(false), 1200);
  };

  const handleSpeakToken = (text: string, customRate?: number) => {
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function'
    ) {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text);
        utterance.lang = 'en-US';
        utterance.rate = customRate ?? speechRate;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Fallback for environments where speech synthesis is disabled or blocked
      }
    }
  };

  const handleSpeakSentence = (sentenceId: string, text: string) => {
    setPlayingSentenceId(sentenceId);
    handleSpeakToken(text);
    window.setTimeout(() => setPlayingSentenceId((curr) => (curr === sentenceId ? null : curr)), 1000);
  };

  const handleShadowSentence = (sentenceId: string, text: string) => {
    setPlayingSentenceId(sentenceId);
    if (
      typeof window !== 'undefined' &&
      'speechSynthesis' in window &&
      typeof window.SpeechSynthesisUtterance === 'function' &&
      text.trim()
    ) {
      try {
        window.speechSynthesis.cancel();
        const normalUtterance = new window.SpeechSynthesisUtterance(text);
        normalUtterance.lang = 'en-US';
        normalUtterance.rate = 1;
        const slowUtterance = new window.SpeechSynthesisUtterance(text);
        slowUtterance.lang = 'en-US';
        slowUtterance.rate = 0.75;
        slowUtterance.onend = () => setPlayingSentenceId((curr) => (curr === sentenceId ? null : curr));
        slowUtterance.onerror = () => setPlayingSentenceId((curr) => (curr === sentenceId ? null : curr));
        window.speechSynthesis.speak(normalUtterance);
        window.speechSynthesis.speak(slowUtterance);
      } catch {
        // ignore speech synthesis errors
      }
    }
    window.setTimeout(() => {
      setPlayingSentenceId((curr) => (curr === sentenceId ? null : curr));
    }, 1800);
  };

  const selectedToken = activeToken;
  const selectedSentence = selectedToken?.sentenceId
    ? passage.sentences.find((sentence) => sentence.id === selectedToken.sentenceId)
    : undefined;
  const currentSegmentIndex = passage.progress
    ? passage.segments.findIndex((segment) => segment.id === passage.progress?.currentSegmentId)
    : -1;
  const translatableSentenceIds = passage.sentences
    .filter((s) => Boolean(s.translationVi?.trim()))
    .map((s) => s.id);
  const allTranslationsRevealed =
    translatableSentenceIds.length > 0 &&
    translatableSentenceIds.every((id) => revealedSentenceIds.has(id));

  return (
    <div className="mx-auto w-full min-w-0 max-w-4xl space-y-2 sm:space-y-4">
      <header className="flex min-w-0 items-center gap-3 rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--surface-warm)]/35 p-4 shadow-[var(--shadow-xs)] sm:gap-5 sm:p-6">
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
        Chạm từ được gạch dưới để tra từ. Muốn chủ động học một từ, chọn “Lưu vào ôn tập”; lưu câu hoặc bài chỉ là dấu trang.
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

      <div className="flex flex-wrap items-center gap-1.5 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] p-2 shadow-[var(--shadow-xs)]">
        {(Boolean(passage.audioUrl) || passage.sentences.length > 0) && (
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
          variant={speechRate === 0.75 ? 'secondary' : 'ghost'}
          size="sm"
          onClick={() => setSpeechRate((prev) => (prev === 1 ? 0.75 : 1))}
          aria-label={speechRate === 0.75 ? 'Tốc độ đọc chậm 0.75x đang bật' : 'Bật tốc độ đọc chậm 0.75x'}
          data-testid="reader-slow-audio-toggle"
        >
          {speechRate === 0.75 ? '🐢 Chậm 0.75x' : '1.0x Bình thường'}
        </Button>
        {translatableSentenceIds.length > 0 && (
          <Button
            variant="ghost"
            size="sm"
            leftIcon={<Languages className="h-4 w-4" />}
            onClick={() => {
              if (allTranslationsRevealed) {
                setRevealedSentenceIds(new Set());
              } else {
                setRevealedSentenceIds(new Set(translatableSentenceIds));
              }
            }}
          >
            {allTranslationsRevealed ? 'Ẩn nghĩa toàn bài' : 'Hiện nghĩa toàn bài'}
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
                className="min-w-0 scroll-mt-6 space-y-4 rounded-3xl border border-[var(--border-subtle)] bg-[var(--surface)] p-4 shadow-[var(--shadow-xs)] sm:p-6"
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
                      data-playing={playingSentenceId === sentence.id ? 'true' : 'false'}
                      className={`min-w-0 space-y-1.5 rounded-2xl py-1.5 transition-all ${playingSentenceId === sentence.id ? 'bg-[var(--surface-lilac)]/55 px-3 ring-2 ring-[var(--action-primary)]/35' : ''}`}
                    >
                      <p className="reader-copy break-words text-[1.18rem] text-[var(--text-primary)] sm:text-[1.3rem]">
                        {sentence.tokens.map((token, tokenIndex) => token.conceptId ? (
                          <React.Fragment key={`${sentence.id}:${tokenIndex}`}>
                            <button
                              type="button"
                              data-concept-status={token.status ?? 'unseen'}
                              aria-describedby={token.status ? `reader-token-status-${sentence.id}-${tokenIndex}` : undefined}
                              onClick={(event) => {
                                setQuickLookupToken(null);
                                inspectorTriggerRef.current = event.currentTarget;
                                void reader.inspectToken(token);
                              }}
                              className={`mx-0.5 inline break-words rounded-md border-b-2 px-1 font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] ${getConceptTokenHighlightClass(token.status)}`}
                            >
                              {token.raw}
                            </button>
                            {token.status && <span id={`reader-token-status-${sentence.id}-${tokenIndex}`} className="sr-only">{conceptStateMetadata[token.status].labelVi}: {conceptStateMetadata[token.status].descriptionVi}</span>}
                          </React.Fragment>
                        ) : /[A-Za-z]{2,}/.test(token.raw) ? (
                          <span
                            key={`${sentence.id}:${tokenIndex}`}
                            data-testid="reader-helper-word"
                            onClick={() => {
                              reader.closeInspector();
                              const entry = lookupBeginnerWord(token.raw);
                              setQuickLookupToken({
                                raw: token.raw,
                                lemma: entry?.lemma ?? token.raw.toLowerCase().replace(/[^a-z']/g, ''),
                                pos: entry?.posVi ?? 'Từ trong ngữ cảnh',
                                ipa: entry?.ipa,
                                translationVi: entry?.meaningVi ?? 'Từ tiếng Anh trong câu — bấm loa để nghe phát âm và xem nghĩa cả câu bên trên.',
                                sentenceId: sentence.id,
                                segmentId: segment.id,
                              });
                            }}
                            title="Chạm để nghe phát âm & xem nghĩa nhanh"
                            className="cursor-pointer rounded px-0.5 decoration-[var(--border-default)] decoration-dotted underline-offset-4 transition-colors hover:bg-[var(--surface-lilac)]/60 hover:underline"
                          >
                            {token.raw}
                          </span>
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
                          <div className="flex items-center gap-1">
                            <Button
                              variant="ghost"
                              size="icon"
                              aria-label={`Nghe câu ${sentenceNumber}`}
                              title={`Nghe câu ${sentenceNumber}`}
                              onClick={() => handleSpeakSentence(sentence.id, sentence.tokens.map((t) => t.raw).join(''))}
                            >
                              <Volume2 className={`h-4 w-4 ${playingSentenceId === sentence.id ? 'text-[var(--action-primary)]' : 'text-[var(--text-muted)]'}`} />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid="reader-shadowing-button"
                              aria-label={`Nhại lại câu ${sentenceNumber}`}
                              title="Nghe 1.0x rồi 0.75x để đọc nhại theo (Shadowing)"
                              onClick={() =>
                                handleShadowSentence(
                                  sentence.id,
                                  sentence.tokens.map((t) => t.raw).join(''),
                                )
                              }
                            >
                              🗣️ Nhại lại
                            </Button>
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
                        </div>
                        {hasTranslation && meaningIsRevealed && (
                          <>
                            <p
                              id={`reader-translation-${sentence.id}`}
                              className="reader-copy rounded-r-xl border-l-3 border-[var(--action-primary)] bg-[var(--surface-subtle)]/70 py-2 pl-3.5 pr-3 text-sm leading-6 text-[var(--text-secondary)]"
                            >
                              {sentence.translationVi}
                            </p>
                            <p
                              data-testid={`reader-grammar-tip-${sentence.id}`}
                              className="mt-1 rounded-xl bg-[var(--surface-lilac)]/45 px-3 py-1.5 text-xs leading-5 text-[var(--text-secondary)]"
                            >
                              <span className="font-bold text-[var(--action-primary)]">💡 Mẹo hiểu câu: </span>
                              {getSentenceStructureTip(sentence.tokens.map((t) => t.raw).join(''))}
                            </p>
                          </>
                        )}
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
          <div className="mt-4 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 px-4 py-3">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-[var(--text-secondary)]">Bài đọc đã hoàn thành. Bạn có thể xem hoạt động trong kế hoạch hôm nay.</p>
              <Link
                href="/today"
                prefetch={false}
                className="inline-flex min-h-11 items-center rounded-lg font-semibold text-[var(--action-primary)] underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                Xem kế hoạch hôm nay
              </Link>
            </div>
            {recallConcepts.length > 0 && (
              <div
                data-testid="reader-completion-recall"
                className="mt-3 border-t border-[var(--border-subtle)] pt-3"
              >
                <p className="text-xs font-bold text-[var(--text-primary)]">
                  ⚡ Kiểm tra trí nhớ nhanh sau bài đọc (Chạm để lật nghĩa):
                </p>
                <div className="mt-2 flex flex-wrap gap-2">
                  {recallConcepts.map((item) => {
                    const cid = item.conceptId!;
                    const isRevealed = revealedRecallIds.has(cid);
                    const fallbackEntry = lookupBeginnerWord(item.lemma ?? item.raw);
                    const meaning = item.translationVi ?? fallbackEntry?.meaningVi ?? 'Đã lưu trong bài';
                    return (
                      <button
                        key={cid}
                        type="button"
                        data-testid={`reader-recall-chip-${cid}`}
                        onClick={() =>
                          setRevealedRecallIds((prev) => {
                            const next = new Set(prev);
                            if (next.has(cid)) next.delete(cid);
                            else next.add(cid);
                            return next;
                          })
                        }
                        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3 py-1.5 text-xs font-semibold text-[var(--text-primary)] transition-colors hover:border-[var(--action-primary)]"
                      >
                        <span>{item.lemma ?? item.raw}</span>
                        {isRevealed ? (
                          <span className="text-[var(--action-primary)]">→ {meaning}</span>
                        ) : (
                          <span className="text-[var(--text-muted)]">(Chạm xem nghĩa)</span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
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
              <div className="flex items-center gap-1.5">
                <h3 className="break-words text-lg font-extrabold tracking-[-0.02em] text-[var(--text-primary)]">{selectedToken.lemma ?? selectedToken.raw}</h3>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Phát âm từ vựng"
                  title="Phát âm từ vựng"
                  onClick={() => handleSpeakToken(selectedToken.lemma ?? selectedToken.raw)}
                >
                  <Volume2 className="h-4 w-4 text-[var(--action-primary)]" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label="Phát âm chậm 0.75x"
                  title="Phát âm chậm 0.75x cho người mới"
                  onClick={() => handleSpeakToken(selectedToken.lemma ?? selectedToken.raw, 0.75)}
                >
                  🐢 0.75x
                </Button>
              </div>
              {selectedToken.status && <ConceptChip status={selectedToken.status} size="sm" />}
            </div>
            <Button ref={inspectorCloseButtonRef} variant="ghost" size="icon" onClick={closeActiveInspector} aria-label="Đóng bảng tra từ">
              <X className="h-4 w-4" />
            </Button>
          </div>

          <div className="mt-2 rounded-2xl bg-[var(--surface-subtle)] px-3 py-2.5 text-sm leading-5 text-[var(--text-secondary)]" aria-busy={reader.inspecting}>
            {reader.inspecting && <p className="text-xs text-[var(--text-muted)]">Đang tải nghĩa từ...</p>}
            {selectedSentence?.translationVi.trim() && (
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
                {[selectedToken.ipa, formatBeginnerPosVi(selectedToken.pos)].filter(Boolean).join(' · ')}
              </p>
            )}
            <p data-testid="inspector-pron-tip" className="mt-1.5 text-xs text-[var(--action-primary)]">
              🗣️ {getVietnamesePronunciationTip(selectedToken.lemma ?? selectedToken.raw, selectedToken.ipa)}
            </p>
            {selectedToken.explanationEn && <details className="mt-1 text-xs text-[var(--text-muted)]"><summary className="cursor-pointer">Định nghĩa tiếng Anh</summary><p className="mt-1 leading-4">{selectedToken.explanationEn}</p></details>}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
            {!selectedToken.conceptId && (
              <span className="text-xs text-[var(--text-muted)]">
                Từ bổ trợ trong câu · Bấm từ gạch chân để lưu vào Brain
              </span>
            )}
            <div className="ml-auto">
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
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
