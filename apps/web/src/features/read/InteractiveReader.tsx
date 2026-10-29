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
  getLearnerTrapWarning,
  getFalseFriendTrap,
  getIrregularVerbInfo,
  getWordFamilyHint,
  getSemanticContrastTip,
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
  const [copiedSentenceId, setCopiedSentenceId] = useState<string | null>(null);
  const [fontScale, setFontScale] = useState<'standard' | 'large' | 'xlarge'>('standard');
  const [zenMode, setZenMode] = useState(false);
  const [readerTheme, setReaderTheme] = useState<'default' | 'sepia' | 'dark'>('default');
  const [showGrammarTips, setShowGrammarTips] = useState(true);
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
  const savedSentenceIds = reader.savedSentenceIds;

  const activeToken = reader.selectedToken ?? quickLookupToken;
  const closeActiveInspector = React.useCallback(() => {
    setQuickLookupToken(null);
    reader.closeInspector();
  }, [reader.closeInspector]);

  const lexicalCounts = React.useMemo(() => {
    const seen = new Set<string>();
    let mastered = 0;
    let learning = 0;
    let unseen = 0;
    for (const s of passage?.sentences ?? []) {
      for (const t of s.tokens) {
        if (t.conceptId && !seen.has(t.conceptId)) {
          seen.add(t.conceptId);
          const status = t.status as string | undefined;
          if (status === 'mastered') mastered += 1;
          else if (status === 'learning' || status === 'reviewing') learning += 1;
          else unseen += 1;
        }
      }
    }
    return { mastered, learning, unseen, total: mastered + learning + unseen };
  }, [passage]);

  const estimatedReadMinutes = Math.max(1, Math.ceil((passage?.sentences?.length ?? 1) * 0.5));

  const readerFontSizeClass =
    fontScale === 'xlarge'
      ? 'text-[1.45rem] sm:text-[1.6rem] leading-relaxed'
      : fontScale === 'large'
        ? 'text-[1.3rem] sm:text-[1.45rem] leading-relaxed'
        : 'text-[1.18rem] sm:text-[1.3rem]';
  const fontScaleLabel =
    fontScale === 'xlarge'
      ? 'Aa Cỡ chữ: Rất lớn'
      : fontScale === 'large'
        ? 'Aa Cỡ chữ: Lớn'
        : 'Aa Cỡ chữ: Chuẩn';

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
    setCopiedSentenceId(null);
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

  const handleCopySentence = async (sentenceId: string, englishText: string, translationVi?: string) => {
    const payload = translationVi ? `${englishText} — ${translationVi}` : englishText;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(payload);
      } catch {
        // ignore clipboard errors
      }
    }
    setCopiedSentenceId(sentenceId);
    window.setTimeout(() => {
      setCopiedSentenceId((curr) => (curr === sentenceId ? null : curr));
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

  const cefrBeginnerLabel =
    passage.level === 'A1'
      ? 'A1 · Cơ bản cho người mới'
      : passage.level === 'A2'
        ? 'A2 · Giao tiếp sơ cấp'
        : passage.level === 'B1'
          ? 'B1 · Đọc hiểu tự tin'
          : `${passage.level} · Nâng cao`;

  return (
    <div
      data-reader-zen={zenMode ? 'true' : 'false'}
      data-reader-theme={readerTheme}
      className={`mx-auto w-full min-w-0 max-w-4xl space-y-2 sm:space-y-4 ${
        readerTheme === 'sepia'
          ? 'bg-amber-50/40'
          : readerTheme === 'dark'
            ? 'bg-slate-900/5'
            : ''
      } ${zenMode ? 'rounded-3xl bg-[var(--surface-subtle)]/35 p-3 sm:p-6 transition-all' : ''}`.trim()}
    >
      <header className="flex min-w-0 items-center gap-3 rounded-3xl border border-[var(--border-subtle)] bg-gradient-to-br from-[var(--surface)] via-[var(--surface)] to-[var(--surface-warm)]/35 p-4 shadow-[var(--shadow-xs)] sm:gap-5 sm:p-6">
        <div className="min-w-0 flex-1">
          {isExplicitSample && <p className="mb-1 text-[10px] font-semibold text-[var(--text-muted)]">Bản xem trước · dữ liệu mẫu</p>}
          <p className="lingua-kicker font-mono text-xs uppercase tracking-[0.06em] text-[var(--text-muted)]">
            Interactive Reader • <span data-testid="reader-cefr-beginner-label">{cefrBeginnerLabel}</span> • {passage.wordCount} từ{!isSamplePassage ? ` • ${passage.familiarityRate}% từ quen` : ''}
          </p>
          <h1 className="mt-1 max-w-[13ch] text-[26px] font-bold leading-[1.08] tracking-[-0.04em] text-[var(--text-primary)] sm:text-3xl">{passage.title}</h1>
          <div
            data-testid="reader-lexical-distribution"
            aria-label="Phân bổ từ vựng bài đọc"
            className="mt-2.5 flex flex-wrap items-center gap-1.5 text-[11px] font-semibold"
          >
            <span className="rounded-full border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-0.5 text-[var(--text-primary)]">
              {lexicalCounts.mastered} từ vững
            </span>
            <span className="rounded-full border border-amber-500/40 bg-amber-500/10 px-2.5 py-0.5 text-[var(--text-primary)]">
              {lexicalCounts.learning} đang học
            </span>
            <span className="rounded-full border border-[var(--action-primary)]/40 bg-[var(--surface-lilac)] px-2.5 py-0.5 text-[var(--text-primary)]">
              {lexicalCounts.unseen} từ mới
            </span>
            <span
              data-testid="reader-estimated-time"
              aria-label="Thời gian đọc ước tính"
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]"
            >
              ⏱️ ~{estimatedReadMinutes} phút đọc
            </span>
            <span
              data-testid="reader-sentence-count-pill"
              aria-label="Tổng số câu trong bài đọc"
              className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-0.5 font-mono text-[11px] font-semibold text-[var(--text-secondary)]"
            >
              📄 {passage.sentences.length} câu trong bài
            </span>
          </div>
          <div
            data-testid="wave10-reader-wpm-meter"
            aria-label="Tốc độ đọc ước tính và thời gian đọc bài"
            className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-secondary)]"
          >
            <span>🐢 Nhịp đọc gợi ý cho người mới (~{estimatedReadMinutes} phút đọc thong thả)</span>
          </div>
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
        <span
          data-testid="reader-beginner-toolbar-hint"
          className="w-full basis-full pb-1 text-[11px] font-semibold text-[var(--text-muted)]"
        >
          💡 Mẹo cho người mới: Chạm vào bất kỳ từ tiếng Anh nào trong bài để xem nghĩa tiếng Việt và nghe phát âm.
        </span>
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
        <Button
          variant={fontScale !== 'standard' ? 'secondary' : 'ghost'}
          size="sm"
          data-testid="reader-font-size-toggle"
          aria-label="Điều chỉnh kích cỡ chữ bài đọc"
          onClick={() =>
            setFontScale((prev) =>
              prev === 'standard' ? 'large' : prev === 'large' ? 'xlarge' : 'standard',
            )
          }
        >
          {fontScaleLabel}
        </Button>
        <Button
          variant={zenMode ? 'secondary' : 'ghost'}
          size="sm"
          data-testid="reader-focus-mode-toggle"
          aria-label="Bật/tắt chế độ đọc tập trung"
          aria-pressed={zenMode}
          onClick={() => setZenMode((prev) => !prev)}
        >
          {zenMode ? '🧘 Đang tập trung' : '🧘 Đọc tập trung'}
        </Button>
        <Button
          variant={readerTheme !== 'default' ? 'secondary' : 'ghost'}
          size="sm"
          data-testid="wave9-reader-reading-theme-toggle"
          aria-label="Chuyển chế độ nền đọc: Mặc định, Sepia ấm áp hoặc Đêm"
          onClick={() =>
            setReaderTheme((prev) =>
              prev === 'default' ? 'sepia' : prev === 'sepia' ? 'dark' : 'default',
            )
          }
        >
          {readerTheme === 'sepia'
            ? '📜 Nền: Vàng dịu'
            : readerTheme === 'dark'
              ? '🌙 Nền: Dịu tối'
              : '☀️ Nền: Mặc định'}
        </Button>
        <span
          data-testid="reader-saved-sentences-count"
          aria-label="Số câu đã lưu trong bài đọc"
          className="inline-flex items-center gap-1 rounded-full border border-[var(--border-subtle)] bg-[var(--surface)] px-2.5 py-1 font-mono text-xs font-semibold text-[var(--text-secondary)]"
        >
          📌 Đã lưu {savedSentenceIds.size} câu
        </span>
        <Button
          variant={showGrammarTips ? 'secondary' : 'ghost'}
          size="sm"
          data-testid="reader-grammar-tips-toggle"
          aria-label="Bật/tắt gợi ý cấu trúc ngữ pháp từng câu"
          aria-pressed={showGrammarTips}
          onClick={() => setShowGrammarTips((prev) => !prev)}
        >
          {showGrammarTips ? '💡 Ngữ pháp: Hiện' : '💡 Ngữ pháp: Ẩn'}
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
                data-reading-theme={readerTheme}
                className={`min-w-0 scroll-mt-6 space-y-4 rounded-3xl border border-[var(--border-subtle)] p-4 shadow-[var(--shadow-xs)] sm:p-6 transition-colors ${
                  readerTheme === 'sepia'
                    ? 'bg-[#FAF3E0] text-[#3E2C1C]'
                    : readerTheme === 'dark'
                      ? 'bg-[#18181B] text-[#F4F4F5]'
                      : 'bg-[var(--surface)]'
                }`}
              >
                {segment.sentences.map((sentence) => {
                  const sentenceSaved = reader.savedSentenceIds.has(sentence.id);
                  const isSaved = sentenceSaved;
                  const hasTranslation = Boolean(sentence.translationVi?.trim());
                  const meaningIsRevealed = revealedSentenceIds.has(sentence.id);
                  const sentenceNumber = passage.sentences.findIndex((item) => item.id === sentence.id) + 1;
                  return (
                    <article
                      key={sentence.id}
                      data-testid="reader-sentence"
                      data-sentence-id={sentence.id}
                      data-playing={playingSentenceId === sentence.id ? 'true' : 'false'}
                      data-font-scale={fontScale}
                      className={`min-w-0 space-y-1.5 rounded-2xl py-1.5 transition-all ${playingSentenceId === sentence.id ? 'bg-[var(--surface-lilac)]/55 px-3 ring-2 ring-[var(--action-primary)]/35' : ''}`}
                    >
                      <p
                        data-font-scale={fontScale}
                        className={`reader-copy break-words text-[var(--text-primary)] ${readerFontSizeClass}`}
                      >
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
                              🗣️ Đọc theo mẫu (Shadowing)
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid="reader-copy-sentence"
                              aria-label={`Sao chép câu ${sentenceNumber}`}
                              onClick={() =>
                                void handleCopySentence(
                                  sentence.id,
                                  sentence.tokens.map((t) => t.raw).join(''),
                                  sentence.translationVi,
                                )
                              }
                            >
                              {copiedSentenceId === sentence.id ? 'Đã chép câu' : '📋 Chép câu'}
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              data-testid="reader-save-sentence"
                              aria-label={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                              title={sentenceSaved ? `Câu ${sentenceNumber} đã lưu` : `Lưu câu ${sentenceNumber}`}
                              leftIcon={sentenceSaved ? <Check className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
                              disabled={sentenceSaved || reader.busyKeys.has(`sentence:${sentence.id}`)}
                              onClick={() => void reader.saveSentence(sentence.id)}
                            >
                              <span data-testid="reader-save-sentence-label" className="ml-1 text-xs">
                                {isSaved ? 'Đã lưu câu' : '📌 Lưu câu'}
                              </span>
                            </Button>
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
                            {showGrammarTips && (
                              <p
                                data-testid={`reader-grammar-tip-${sentence.id}`}
                                className="mt-1 rounded-xl bg-[var(--surface-lilac)]/45 px-3 py-1.5 text-xs leading-5 text-[var(--text-secondary)]"
                              >
                                <span
                                  data-testid={`sentence-grammar-tip-${sentence.id}`}
                                  className="font-bold text-[var(--action-primary)]"
                                >
                                  💡 Mẹo hiểu câu:{' '}
                                </span>
                                {getSentenceStructureTip(sentence.tokens.map((t) => t.raw).join(''))}
                              </p>
                            )}
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
            <p data-testid="inspector-trap-warning" className="mt-1 text-[11px] text-[var(--text-secondary)]">
              ⚠️ {getLearnerTrapWarning(selectedToken.lemma ?? selectedToken.raw)}
            </p>
            {(() => {
              const falseFriendTrap = getFalseFriendTrap(selectedToken.lemma ?? selectedToken.raw);
              return falseFriendTrap ? (
                <div
                  data-testid="wave9-false-friend-warning"
                  className="mt-1.5 rounded-lg border border-amber-500/40 bg-amber-500/10 px-2 py-1.5 text-xs font-medium text-amber-900 dark:text-amber-200"
                >
                  ⚠️ {falseFriendTrap}
                </div>
              ) : null;
            })()}
            <div
              data-testid="inspector-extended-tips-box"
              className="mt-2 rounded-xl border border-[var(--border-subtle)] bg-[var(--surface-subtle)]/50 p-2.5 space-y-1"
            >
              <p className="text-[11px] font-bold text-[var(--text-primary)]">
                📚 Mở rộng vốn từ &amp; Ngữ cảnh:
              </p>
              <p data-testid="inspector-word-family" className="mt-1 text-[11px] text-[var(--text-secondary)]">
                🌱 {getWordFamilyHint(selectedToken.lemma ?? selectedToken.raw)}
              </p>
              <p data-testid="inspector-semantic-contrast" className="mt-1 text-[11px] text-[var(--text-secondary)]">
                ⚖️ {getSemanticContrastTip(selectedToken.lemma ?? selectedToken.raw)}
              </p>
              {(() => {
                const irregular = getIrregularVerbInfo(selectedToken.lemma ?? selectedToken.raw);
                return irregular ? (
                  <div
                    data-testid="wave10-irregular-verb-info"
                    className="mt-1.5 rounded-lg border border-indigo-500/30 bg-indigo-500/10 px-2 py-1.5 text-xs font-medium text-indigo-950 dark:text-indigo-200"
                  >
                    📘 Động từ bất quy tắc: <strong>{irregular.base}</strong> → Quá khứ: <strong>{irregular.past}</strong> (Phân từ: {irregular.participle}) · Nghĩa: {irregular.vi}
                  </div>
                ) : null;
              })()}
            </div>
            {selectedToken.explanationEn && (
              <details className="mt-1 text-xs text-[var(--text-muted)]">
                <summary
                  data-testid="inspector-english-def-summary"
                  className="cursor-pointer font-medium text-[var(--text-secondary)]"
                >
                  Định nghĩa gốc tiếng Anh (Tham khảo nâng cao)
                </summary>
                <p className="mt-1 leading-4">{selectedToken.explanationEn}</p>
              </details>
            )}
          </div>

          <div className="mt-2 flex items-center justify-between border-t border-[var(--border-subtle)] pt-2">
            {!selectedToken.conceptId && (
              <span className="text-xs text-[var(--text-muted)]">
                Từ bổ trợ tiếng Anh cơ bản (Bấm từ gạch chân để lưu vào Kho từ nhớ)
              </span>
            )}
            <div className="ml-auto flex items-center gap-2">
              <Button
                variant="ghost"
                size="sm"
                data-testid="inspector-open-dictionary-link"
                aria-label="Mở từ này trong Từ điển để xem chi tiết"
                onClick={() => clientNavigate('/dictionary')}
              >
                🔎 Mở Từ điển
              </Button>
              {selectedToken.conceptId && reader.savedConceptIds.has(selectedToken.conceptId) ? (
                <Button variant="secondary" size="sm" leftIcon={<Check className="h-3.5 w-3.5" />} disabled>
                  <span data-testid="inspector-saved-status-label">
                    Đã lưu vào ôn tập (Kho từ nhớ)
                  </span>
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
