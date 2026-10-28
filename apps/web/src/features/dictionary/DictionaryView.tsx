'use client';

import React, { useState } from 'react';
import { Card, Button, ConceptChip, Badge, LoadingState, EmptyState, ErrorState, InlineAlert } from '@lingua/ui';
import { Search, Volume2, Plus, Check, X, ChevronDown, RotateCcw } from 'lucide-react';
import { type ApiErrorCode, type ApiClient } from '@lingua/types';
import { defaultDictionaryConcepts, type DictionaryConceptItem } from '../../fixtures/dictionaryFixture';
import { partOfSpeechLabels } from './adapters';
import { useConceptDiscovery } from './useConceptDiscovery';
import { clientNavigate } from '../../lib/navigation/clientNavigate';

export interface DictionaryViewProps {
  initialConcepts?: DictionaryConceptItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  apiClient?: ApiClient;
}

function getWordComplexityLabel(term: string): string {
  const clean = term.trim();
  if (clean.length <= 5) return 'Ngắn · Dễ nhớ';
  if (clean.length <= 8) return 'Độ dài vừa';
  return 'Đa âm tiết';
}

export function DictionaryView({ initialConcepts = defaultDictionaryConcepts, forcedState = 'success', forcedErrorCode = 'INTERNAL_ERROR', apiClient }: DictionaryViewProps) {
  const discovery = useConceptDiscovery({ apiClient, initialConcepts });
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);
  const [copiedTermId, setCopiedTermId] = useState<string | null>(null);
  const [selectedCefr, setSelectedCefr] = useState<'ALL' | 'A1' | 'A2' | 'B1'>('ALL');
  const [recentSearches, setRecentSearches] = useState<string[]>(['morning', 'practice']);
  const [searchDirection, setSearchDirection] = useState<'en-vi' | 'vi-en'>('en-vi');

  const handleCopyTerm = async (id: string, term: string, ipa?: string) => {
    const text = ipa ? `${term} (${ipa})` : term;
    if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
      try {
        await navigator.clipboard.writeText(text);
      } catch {
        // ignore clipboard errors
      }
    }
    setCopiedTermId(id);
    setTimeout(() => {
      setCopiedTermId((curr) => (curr === id ? null : curr));
    }, 1800);
  };

  const recordSearchTerm = (term: string) => {
    const clean = term.trim();
    if (!clean) return;
    setRecentSearches((prev) => [clean, ...prev.filter((item) => item.toLowerCase() !== clean.toLowerCase())].slice(0, 5));
  };

  const handlePlayAudio = (id: string, text?: string, rate: number = 1) => {
    setPlayingAudioId(id);
    if (typeof window !== 'undefined' && 'speechSynthesis' in window && typeof window.SpeechSynthesisUtterance === 'function') {
      try {
        window.speechSynthesis.cancel();
        const utterance = new window.SpeechSynthesisUtterance(text ?? id);
        utterance.lang = 'en-US';
        utterance.rate = rate;
        window.speechSynthesis.speak(utterance);
      } catch {
        // Safe fallback in headless/test environments
      }
    }
    setTimeout(() => setPlayingAudioId(null), 800);
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  const baseDirectResults = discovery.lemmaGroups === null
    ? discovery.results.filter((concept) => selectedCefr === 'ALL' || concept.cefrLevel === selectedCefr)
    : [];

  const viEnFallbackResults =
    searchDirection === 'vi-en' && discovery.searchQuery.trim()
      ? initialConcepts
          .filter((concept) => selectedCefr === 'ALL' || concept.cefrLevel === selectedCefr)
          .filter((concept) =>
            concept.definitions.some((d) =>
              d.meaningVi.toLowerCase().includes(discovery.searchQuery.trim().toLowerCase())
            )
          )
          .map((c) => ({
            id: c.id,
            term: c.term,
            lemma: c.lemma,
            pos: c.pos,
            ipa: c.ipa,
            cefrLevel: c.cefrLevel,
            status: c.status,
            isDue: c.isDue,
            isSaved: discovery.isSaved(c.id),
            primaryTranslationVi: c.primaryTranslationVi,
            definitions: c.definitions.map((d) => ({
              meaningVi: d.meaningVi,
              explanationEn: d.explanationEn,
              examples: d.examples?.map((ex) => ({ source: ex.source, target: ex.target })),
            })),
          }))
      : [];

  const visibleLemmaGroups =
    discovery.lemmaGroups === null || (searchDirection === 'vi-en' && viEnFallbackResults.length > 0 && discovery.lemmaGroups.length === 0)
      ? null
      : [...new Map(discovery.lemmaGroups.map((group) => [group.lexemeId, group])).values()];
  const groupedConceptIds = new Set(
    visibleLemmaGroups?.flatMap((group) =>
      group.senses.flatMap((sense) => sense.concepts.map((linked) => linked.concept.id))
    ) ?? []
  );
  const ungroupedResults = visibleLemmaGroups === null
    ? []
    : [
        ...discovery.results
          .filter((concept) => !groupedConceptIds.has(concept.id))
          .filter((concept) => selectedCefr === 'ALL' || concept.cefrLevel === selectedCefr),
        ...(searchDirection === 'vi-en' ? viEnFallbackResults.filter((vi) => !groupedConceptIds.has(vi.id)) : []),
      ];
  const visibleDirectResults =
    baseDirectResults.length > 0
      ? (searchDirection === 'vi-en' && viEnFallbackResults.length > 0
          ? [...baseDirectResults, ...viEnFallbackResults.filter((viItem) => !baseDirectResults.some((b) => b.id === viItem.id))]
          : baseDirectResults)
      : viEnFallbackResults;

  const renderSaveAction = (conceptId: string, term: string, serverSaysSaved = false) => {
    if (serverSaysSaved || discovery.isSaved(conceptId)) {
      return <span className="inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border border-[var(--status-success-border,#D1FAE5)] bg-[var(--status-success-bg,#ECFDF5)] px-3 py-2 text-xs font-bold text-[var(--status-success,#059669)]" aria-label={`Đã lưu từ ${term} vào kho học`}><Check className="h-4 w-4" />Đã lưu</span>;
    }
    if (discovery.isSaving(conceptId)) {
      return <Button variant="primary" size="sm" disabled aria-busy="true" aria-label={`Đang lưu từ ${term}`}>Đang lưu...</Button>;
    }
    if (discovery.reconciliationError) {
      return <Button variant="outline" size="sm" onClick={() => void discovery.retryReconciliation()} aria-label={`Thử đồng bộ lại trạng thái lưu của từ ${term}`}><RotateCcw className="mr-1 h-3.5 w-3.5" />Thử đồng bộ lại</Button>;
    }
    if (!discovery.isSavedStateReady) {
      return <Button variant="outline" size="sm" disabled aria-busy="true" aria-label={`Đang kiểm tra trạng thái lưu của từ ${term}`}>Đang kiểm tra...</Button>;
    }
    return <Button variant="primary" size="sm" onClick={() => void discovery.saveConcept(conceptId)} aria-label={`Lưu từ ${term} để học`}><Plus className="mr-1.5 h-4 w-4" />Lưu để học</Button>;
  };

  if (currentState === 'loading') return <LoadingState message="Đang nạp dữ liệu từ điển và tra cứu ngữ cảnh..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty') return <EmptyState title="Không tìm thấy từ vựng" description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn." actionLabel="Xóa bộ lọc" onAction={() => { discovery.clearSearch(); setSelectedCefr('ALL'); }} />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <div className="lingua-kicker text-[var(--action-primary)]">Tra cứu</div>
        <h1 className="mt-2 text-3xl font-bold leading-tight tracking-[-0.04em] text-[var(--text-primary)] sm:text-4xl">Từ điển</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-base">Tìm nghĩa, cách phát âm, ví dụ và trạng thái học đã ghi nhận.</p>
        <div className="mt-3 flex flex-wrap items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            data-testid="dictionary-practice-reader-link"
            aria-label="Chuyển sang bài đọc ngữ cảnh để thực hành từ vựng"
            onClick={() => clientNavigate('/read')}
          >
            📖 Luyện đọc ngữ cảnh
          </Button>
        </div>
      </header>

      <section className="rounded-[20px] border border-[var(--border-subtle)] bg-[var(--surface)] p-3 shadow-[var(--shadow-card)] sm:p-5" aria-label="Tìm từ">
        <div>
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              placeholder="Nhập từ vựng, cụm từ tiếng Anh..."
              value={discovery.searchQuery}
              onChange={(e) => discovery.setSearchQuery(e.target.value)}
              aria-label="Nhập từ vựng, cụm từ tiếng Anh..."
              className="min-h-[52px] w-full min-w-0 rounded-[14px] border border-[var(--border-default)] bg-[var(--surface-subtle)] pl-12 pr-11 text-base font-medium text-[var(--text-primary)] outline-none transition-shadow placeholder:font-normal placeholder:text-[var(--text-muted)] focus:bg-[var(--surface)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
            {discovery.searchQuery && <button type="button" onClick={discovery.clearSearch} className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="Xóa từ khóa tìm kiếm"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]">
            <span className="rounded-full bg-white/80 px-3 py-1.5">Nghĩa tiếng Việt</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5">IPA & từ loại</span>
            <span className="rounded-full bg-white/80 px-3 py-1.5">Ví dụ ngữ cảnh</span>
            <button
              type="button"
              data-testid="dictionary-search-lang-toggle"
              aria-label="Chuyển chế độ tìm kiếm: Anh-Việt hoặc Việt-Anh"
              onClick={() => setSearchDirection((prev) => (prev === 'en-vi' ? 'vi-en' : 'en-vi'))}
              className="rounded-full border border-[var(--action-primary)]/40 bg-[var(--surface-lilac)] px-3 py-1.5 text-xs font-bold text-[var(--action-primary)] transition-colors hover:bg-[var(--action-primary)] hover:text-white"
            >
              {searchDirection === 'en-vi' ? '🔄 Chế độ: Anh ↔ Việt' : '🇻🇳 Chế độ: Tìm bằng tiếng Việt'}
            </button>
          </div>

          <div data-testid="dictionary-starter-chips" className="mt-3 flex flex-wrap items-center gap-2 text-xs">
            <span className="font-medium text-[var(--text-muted)]">Gợi ý:</span>
            {(['appointment', 'available', 'schedule', 'tea'] as const).map((word) => (
              <button
                key={word}
                type="button"
                onClick={() => {
                  discovery.setSearchQuery(word);
                  recordSearchTerm(word);
                }}
                className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-3 py-1 text-xs font-semibold text-[var(--action-primary)] transition-all hover:bg-[var(--action-primary)] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]"
              >
                {word}
              </button>
            ))}
          </div>

          {recentSearches.length > 0 && (
            <div
              data-testid="dictionary-recent-searches"
              className="mt-3 flex flex-wrap items-center justify-between gap-2 rounded-2xl border border-[var(--border-subtle)] bg-[var(--surface)] px-3.5 py-2"
            >
              <div className="flex flex-wrap items-center gap-1.5">
                <span className="text-xs font-semibold text-[var(--text-muted)]">
                  🕒 Tra cứu gần đây:
                </span>
                {recentSearches.map((term) => (
                  <button
                    key={term}
                    type="button"
                    onClick={() => {
                      discovery.setSearchQuery(term);
                      recordSearchTerm(term);
                    }}
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2.5 py-0.5 text-xs font-medium text-[var(--text-secondary)] transition-colors hover:border-[var(--action-primary)] hover:text-[var(--action-primary)]"
                  >
                    {term}
                  </button>
                ))}
              </div>
              <button
                type="button"
                data-testid="dictionary-clear-history"
                onClick={() => setRecentSearches([])}
                className="text-xs font-semibold text-[var(--text-muted)] hover:text-[var(--text-primary)]"
              >
                Xóa lịch sử
              </button>
            </div>
          )}

          <div
            data-testid="dictionary-cefr-filter"
            role="group"
            aria-label="Lọc theo cấp độ CEFR"
            className="mt-3 flex flex-wrap items-center gap-1.5 border-t border-[var(--border-subtle)]/70 pt-3 text-xs"
          >
            <span className="mr-1 font-semibold text-[var(--text-muted)]">Cấp độ CEFR:</span>
            {(
              [
                { value: 'ALL', label: 'Tất cả' },
                { value: 'A1', label: 'A1' },
                { value: 'A2', label: 'A2' },
                { value: 'B1', label: 'B1' },
              ] as const
            ).map((level) => {
              const active = selectedCefr === level.value;
              return (
                <button
                  key={level.value}
                  type="button"
                  aria-pressed={active}
                  onClick={() => setSelectedCefr(level.value)}
                  className={`rounded-xl px-3 py-1 text-xs font-bold transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${
                    active
                      ? 'bg-[var(--action-primary)] text-white shadow-xs'
                      : 'border border-[var(--border-subtle)] bg-[var(--surface-subtle)] text-[var(--text-secondary)] hover:bg-[var(--surface)]'
                  }`}
                >
                  {level.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {discovery.saveError && <InlineAlert variant="danger" title="Không thể lưu từ vựng">{discovery.saveError.message}</InlineAlert>}
      {discovery.reconciliationError && <div className="space-y-2"><InlineAlert variant="danger" title="Lỗi đồng bộ kho từ vựng">{discovery.reconciliationError.message}</InlineAlert><Button variant="outline" size="sm" onClick={() => void discovery.retryReconciliation()} aria-label="Thử đồng bộ lại kho từ vựng"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Thử đồng bộ lại</Button></div>}
      {discovery.searchError && <div className="space-y-2"><InlineAlert variant="danger" title="Lỗi tra cứu từ điển">{discovery.searchError.message}</InlineAlert><Button variant="outline" size="sm" onClick={discovery.retrySearch}>Thử lại</Button></div>}
      {discovery.isSearching && <LoadingState message="Đang tra cứu từ điển..." count={2} />}

      {!discovery.isSearching && visibleLemmaGroups !== null && (
        <div className="grid min-w-0 grid-cols-1 gap-4">
          {visibleLemmaGroups.map((group) => (
            group.senses.length === 0 ? null : (
            <Card key={group.lexemeId} padding="lg" className="min-w-0 overflow-hidden">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="break-words text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{group.lemma}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayAudio(group.lexemeId, group.lemma)}
                      aria-label={`Phát âm từ ${group.lemma}`}
                      className="h-10 w-10 shrink-0 rounded-2xl"
                    >
                      <Volume2 className={`h-4 w-4 text-[var(--action-primary)] ${playingAudioId === group.lexemeId ? 'animate-bounce' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayAudio(`${group.lexemeId}:slow`, group.lemma, 0.75)}
                      aria-label={`Nghe chậm 0.75x từ ${group.lemma}`}
                      title="Nghe phát âm chậm 0.75x"
                    >
                      🐢 0.75x
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="wave9-dict-super-slow-audio"
                      onClick={() => handlePlayAudio(`${group.lexemeId}:ultraslow`, group.lemma, 0.5)}
                      aria-label={`Nghe siêu chậm 0.5x để phân tích âm vị từ ${group.lemma}`}
                      title="Nghe siêu chậm 0.5x để phân tích âm vị"
                    >
                      <span data-testid="dictionary-ultraslow-audio" className="pointer-events-none">🐢 0.5x Siêu chậm</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="dictionary-copy-term"
                      aria-label={`Sao chép từ ${group.lemma}`}
                      onClick={() => void handleCopyTerm(group.lexemeId, group.lemma, (group as { ipa?: string }).ipa)}
                    >
                      {copiedTermId === group.lexemeId ? 'Đã sao chép' : '📋 Sao chép từ'}
                    </Button>
                  </div>
                  {group.partOfSpeech && <span className="mt-1 block text-xs text-[var(--text-muted)]">{partOfSpeechLabels[group.partOfSpeech] ?? group.partOfSpeech}</span>}
                </div>
                <div className="flex flex-wrap items-center gap-2" aria-label={`Các dạng khớp của ${group.lemma}`}>
                  <span
                    data-testid="dictionary-complexity-tag"
                    aria-label="Độ phức tạp cấu tạo từ"
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--text-secondary)]"
                  >
                    {getWordComplexityLabel(group.lemma)}
                  </span>
                  {group.matchedForms.map((form) => <span key={form} className="rounded-full bg-[var(--surface-subtle)] px-3 py-1.5 text-xs font-medium text-[var(--text-secondary)]">{form}</span>)}
                </div>
              </div>

              <div className="mt-5 space-y-4">
                {group.senses.map((sense) => (
                  <section key={sense.senseId} className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                    <div className="flex flex-col gap-1">
                      <p className="font-semibold leading-6 text-[var(--text-primary)]">{sense.translatedDefinition ?? sense.definition}</p>
                      {sense.translatedDefinition && <p className="text-xs leading-5 text-[var(--text-muted)]">{sense.definition}</p>}
                    </div>
                    {sense.concepts.length > 0 ? (
                      <div className="mt-3 grid min-w-0 grid-cols-1 gap-3 md:grid-cols-2">
                        {sense.concepts.map((linked) => {
                          const concept = linked.concept;
                          const detail = discovery.inspectedDetails.get(concept.id);
                          return (
                            <div key={concept.id} className="min-w-0 rounded-xl border border-[var(--border-subtle)] bg-white p-3">
                              <div className="flex min-w-0 flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                                <div className="min-w-0">
                                  <h3 className="break-words font-bold text-[var(--text-primary)]">{concept.canonicalForm}</h3>
                                  {concept.partOfSpeech && <span className="text-xs text-[var(--text-muted)]">{partOfSpeechLabels[concept.partOfSpeech] ?? concept.partOfSpeech}</span>}
                                </div>
                                <div className="flex shrink-0 flex-wrap items-center gap-2">
                                  <Badge variant="primary" size="sm">{concept.level?.code ?? '—'}</Badge>
                                  <ConceptChip status={concept.status} isDue={concept.isDue} term={concept.canonicalForm} size="sm" />
                                </div>
                              </div>
                              {linked.mastery !== null && <p className="mt-2 text-xs text-[var(--text-muted)]">Độ vững: {Math.round(linked.mastery * 100)}%</p>}
                              {detail ? (
                                <div className="mt-3 space-y-2 border-t border-[var(--border-subtle)] pt-3">
                                  {detail.definitions.map((definition, index) => (
                                    <div key={`${definition.languageCode}-${index}`}>
                                      <p className="font-medium text-[var(--text-primary)]">{definition.translation ?? definition.definition}</p>
                                      {definition.translation && <p className="text-xs text-[var(--text-muted)]">{definition.definition}</p>}
                                    </div>
                                  ))}
                                  {detail.examples.map((example, index) => (
                                    <div key={`${example.text}-${index}`} className="text-xs leading-5 text-[var(--text-secondary)]">
                                      <p className="reader-copy">
                                        “{example.text}”
                                        <button
                                          type="button"
                                          data-testid="dictionary-example-audio"
                                          aria-label="Phát âm câu ví dụ"
                                          onClick={() => handlePlayAudio(`ex:${example.text}`, example.text)}
                                          className="ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--action-primary)] hover:bg-[var(--surface-lilac)]"
                                        >
                                          🔊 Nghe câu
                                        </button>
                                      </p>
                                      {example.translation && <p>→ {example.translation}</p>}
                                    </div>
                                  ))}
                                </div>
                              ) : (
                                <Button className="mt-3" variant="outline" size="sm" onClick={() => void discovery.inspectConcept(concept.id)} disabled={discovery.isInspecting(concept.id)} aria-label={`Xem chi tiết từ ${concept.canonicalForm}`}>
                                  <ChevronDown className="mr-1 h-3.5 w-3.5" />
                                  {discovery.isInspecting(concept.id) ? 'Đang tải chi tiết...' : 'Xem chi tiết & ví dụ'}
                                </Button>
                              )}
                              <div className="mt-3 flex justify-end">{renderSaveAction(concept.id, concept.canonicalForm, linked.isSaved)}</div>
                            </div>
                          );
                        })}
                      </div>
                    ) : <p className="mt-3 text-xs text-[var(--text-muted)]">Chưa có khái niệm liên kết được duyệt.</p>}
                  </section>
                ))}
              </div>
            </Card>
            )
          ))}
          {ungroupedResults.map((concept) => (
            <Card key={concept.id} padding="lg" className="min-w-0 overflow-hidden rounded-[26px]">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="break-words text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{concept.term}</h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayAudio(concept.id, concept.term)}
                      aria-label={`Phát âm từ ${concept.term}`}
                      className="h-10 w-10 shrink-0 rounded-2xl"
                    >
                      <Volume2 className={`h-4 w-4 text-[var(--action-primary)] ${playingAudioId === concept.id ? 'animate-bounce' : ''}`} />
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayAudio(`${concept.id}:slow`, concept.term, 0.75)}
                      aria-label={`Nghe chậm 0.75x từ ${concept.term}`}
                      title="Nghe phát âm chậm 0.75x"
                    >
                      🐢 0.75x
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="wave9-dict-super-slow-audio"
                      onClick={() => handlePlayAudio(`${concept.id}:ultraslow`, concept.term, 0.5)}
                      aria-label={`Nghe siêu chậm 0.5x để phân tích âm vị từ ${concept.term}`}
                      title="Nghe siêu chậm 0.5x để phân tích âm vị"
                    >
                      <span data-testid="dictionary-ultraslow-audio" className="pointer-events-none">🐢 0.5x Siêu chậm</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="dictionary-copy-term"
                      aria-label={`Sao chép từ ${concept.term}`}
                      onClick={() => void handleCopyTerm(concept.id, concept.term, concept.ipa)}
                    >
                      {copiedTermId === concept.id ? 'Đã sao chép' : '📋 Sao chép từ'}
                    </Button>
                  </div>
                  {(concept.ipa || concept.pos) && <span className="mt-1 block font-mono text-xs text-[var(--text-muted)]">{[concept.ipa, concept.pos ? (partOfSpeechLabels[concept.pos] ?? concept.pos) : ''].filter(Boolean).join(' • ')}</span>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    data-testid="dictionary-complexity-tag"
                    aria-label="Độ phức tạp cấu tạo từ"
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--text-secondary)]"
                  >
                    {getWordComplexityLabel(concept.term)}
                  </span>
                  <Badge variant="primary" size="sm">{concept.cefrLevel}</Badge>
                  <ConceptChip status={concept.status} isDue={concept.isDue} term={concept.term} size="sm" />
                </div>
              </div>
              <div className="mt-4">
                {concept.definitions.length > 0 ? concept.definitions.map((definition, index) => (
                  <div key={`${definition.meaningVi}-${index}`} className="rounded-xl bg-[var(--surface-subtle)] p-3">
                    <p className="font-medium text-[var(--text-primary)]">{definition.meaningVi}</p>
                    {definition.explanationEn && <p className="mt-1 text-xs text-[var(--text-muted)]">{definition.explanationEn}</p>}
                    {definition.examples?.map((example, exampleIndex) => (
                      <div key={`${example.source}-${exampleIndex}`} className="mt-2 text-xs leading-5 text-[var(--text-secondary)]">
                        <p>
                          “{example.source}”
                          <button
                            type="button"
                            data-testid="dictionary-example-audio"
                            aria-label="Phát âm câu ví dụ"
                            onClick={() => handlePlayAudio(`ex:${example.source}`, example.source)}
                            className="ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--action-primary)] hover:bg-[var(--surface-lilac)]"
                          >
                            🔊 Nghe câu
                          </button>
                        </p>
                        {example.target && <p>→ {example.target}</p>}
                      </div>
                    ))}
                  </div>
                )) : <Button variant="outline" size="sm" onClick={() => void discovery.inspectConcept(concept.id)} disabled={discovery.isInspecting(concept.id)} aria-label={`Xem chi tiết từ ${concept.term}`}><ChevronDown className="mr-1 h-3.5 w-3.5" />{discovery.isInspecting(concept.id) ? 'Đang tải chi tiết...' : 'Xem chi tiết & ví dụ'}</Button>}
              </div>
              <div className="mt-4 flex justify-end">{renderSaveAction(concept.id, concept.term)}</div>
            </Card>
          ))}
          {visibleLemmaGroups.length === 0 && ungroupedResults.length === 0 && <div><EmptyState title="Không tìm thấy từ vựng" description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn." actionLabel="Xóa bộ lọc" onAction={() => { discovery.clearSearch(); setSelectedCefr('ALL'); }} /></div>}
        </div>
      )}

      {!discovery.isSearching && visibleLemmaGroups === null && (
        <div className="grid min-w-0 grid-cols-1 gap-3">
          {visibleDirectResults.map((concept) => (
            <Card key={concept.id} padding="lg" className="min-w-0 overflow-hidden rounded-[26px]">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{concept.term}</h2>
                    <Button variant="ghost" size="icon" onClick={() => handlePlayAudio(concept.id, concept.term)} aria-label={`Phát âm từ ${concept.term}`} className="h-10 w-10 shrink-0 rounded-2xl"><Volume2 className={`h-4 w-4 text-[var(--action-primary)] ${playingAudioId === concept.id ? 'animate-bounce' : ''}`} /></Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handlePlayAudio(`${concept.id}:slow`, concept.term, 0.75)}
                      aria-label={`Nghe chậm 0.75x từ ${concept.term}`}
                      title="Nghe phát âm chậm 0.75x"
                    >
                      🐢 0.75x
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="wave9-dict-super-slow-audio"
                      onClick={() => handlePlayAudio(`${concept.id}:ultraslow`, concept.term, 0.5)}
                      aria-label={`Nghe siêu chậm 0.5x để phân tích âm vị từ ${concept.term}`}
                      title="Nghe siêu chậm 0.5x để phân tích âm vị"
                    >
                      <span data-testid="dictionary-ultraslow-audio" className="pointer-events-none">🐢 0.5x Siêu chậm</span>
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      data-testid="dictionary-copy-term"
                      aria-label={`Sao chép từ ${concept.term}`}
                      onClick={() => void handleCopyTerm(concept.id, concept.term, concept.ipa)}
                    >
                      {copiedTermId === concept.id ? 'Đã sao chép' : '📋 Sao chép từ'}
                    </Button>
                  </div>
                  {(concept.ipa || concept.pos) && <span className="mt-1 block truncate font-mono text-xs text-[var(--text-muted)]">{[concept.ipa, concept.pos ? (partOfSpeechLabels[concept.pos] ?? concept.pos) : ''].filter(Boolean).join(' • ')}</span>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2">
                  <span
                    data-testid="dictionary-complexity-tag"
                    aria-label="Độ phức tạp cấu tạo từ"
                    className="rounded-full border border-[var(--border-subtle)] bg-[var(--surface-subtle)] px-2 py-0.5 font-mono text-[11px] font-medium text-[var(--text-secondary)]"
                  >
                    {getWordComplexityLabel(concept.term)}
                  </span>
                  <Badge variant="primary" size="sm">{concept.cefrLevel}</Badge>
                  <ConceptChip status={concept.status} isDue={concept.isDue} term={concept.term} size="sm" />
                </div>
              </div>

              <div className="mt-5 min-w-0">
                {concept.definitions && concept.definitions.length > 0 ? (
                  <div className="space-y-4">
                    {concept.definitions.map((def, idx) => (
                      <div key={idx} className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                        <p className="font-bold leading-6 text-[var(--text-primary)]">{def.meaningVi}</p>
                        {def.explanationEn && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{def.explanationEn}</p>}
                        {def.examples && def.examples.length > 0 && (
                          <div className="mt-3 space-y-2 border-l-2 border-[var(--accent-teal)]/35 pl-3 text-xs">
                            {def.examples.map((ex, exIdx) => (
                              <div key={exIdx} className="min-w-0">
                                <p className="leading-5 text-[var(--text-primary)]">
                                  “{ex.source}”
                                  <button
                                    type="button"
                                    data-testid="dictionary-example-audio"
                                    aria-label="Phát âm câu ví dụ"
                                    onClick={() => handlePlayAudio(`ex:${ex.source}`, ex.source)}
                                    className="ml-1.5 inline-flex items-center rounded-md px-1.5 py-0.5 text-[11px] font-semibold text-[var(--action-primary)] hover:bg-[var(--surface-lilac)]"
                                  >
                                    🔊 Nghe câu
                                  </button>
                                </p>
                                <p className="mt-0.5 leading-5 text-[var(--text-muted)]">→ {ex.target}</p>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <Button variant="outline" size="sm" onClick={() => void discovery.inspectConcept(concept.id)} disabled={discovery.isInspecting(concept.id)} aria-label={`Xem chi tiết từ ${concept.term}`}><ChevronDown className="mr-1 h-3.5 w-3.5" />{discovery.isInspecting(concept.id) ? 'Đang tải chi tiết...' : 'Xem chi tiết & ví dụ'}</Button>
                )}
              </div>

              <div className="mt-5 flex min-w-0 flex-col gap-3 border-t border-[var(--border-subtle)] pt-4 sm:flex-row sm:items-center sm:justify-between">
                <span className="text-xs leading-5 text-[var(--text-muted)]">{concept.definitions && concept.definitions.length > 0 ? 'Định nghĩa ngữ nghĩa' : 'Nhấn để xem chi tiết nghĩa'}</span>
                <div className="w-full sm:w-auto">
                  {discovery.isSaved(concept.id) ? (
                    <span className="inline-flex min-h-11 w-full items-center justify-center gap-1.5 rounded-2xl border border-[var(--status-success-border,#D1FAE5)] bg-[var(--status-success-bg,#ECFDF5)] px-3 py-2 text-xs font-bold text-[var(--status-success,#059669)] sm:w-auto" aria-label={`Đã lưu từ ${concept.term} vào kho học`}><Check className="h-4 w-4" />Đã lưu vào kho học</span>
                  ) : discovery.isSaving(concept.id) ? (
                    <Button className="w-full sm:w-auto" variant="primary" size="sm" disabled aria-busy="true" aria-label={`Đang lưu từ ${concept.term}`}>Đang lưu...</Button>
                  ) : discovery.reconciliationError ? (
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" onClick={() => void discovery.retryReconciliation()} aria-label={`Thử đồng bộ lại trạng thái lưu của từ ${concept.term}`}><RotateCcw className="mr-1 h-3.5 w-3.5" />Thử đồng bộ lại</Button>
                  ) : !discovery.isSavedStateReady ? (
                    <Button className="w-full sm:w-auto" variant="outline" size="sm" disabled aria-busy="true" aria-label={`Đang kiểm tra trạng thái lưu của từ ${concept.term}`}>Đang kiểm tra...</Button>
                  ) : (
                    <Button className="w-full sm:w-auto" variant="primary" size="sm" onClick={() => void discovery.saveConcept(concept.id)} aria-label={`Lưu từ ${concept.term} để học`}><Plus className="mr-1.5 h-4 w-4" />Lưu để học</Button>
                  )}
                </div>
              </div>
            </Card>
          ))}
          {visibleDirectResults.length === 0 && <div className="xl:col-span-2"><EmptyState title="Không tìm thấy từ vựng" description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn." actionLabel="Xóa bộ lọc" onAction={() => { discovery.clearSearch(); setSelectedCefr('ALL'); }} /></div>}
        </div>
      )}
    </div>
  );
}
