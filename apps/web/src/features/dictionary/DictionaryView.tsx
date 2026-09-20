'use client';

import React, { useState } from 'react';
import { Card, Button, ConceptChip, Badge, LoadingState, EmptyState, ErrorState, InlineAlert } from '@lingua/ui';
import { Search, Volume2, Plus, Check, X, ChevronDown, RotateCcw } from 'lucide-react';
import { type ApiErrorCode, type ApiClient } from '@lingua/types';
import { defaultDictionaryConcepts, type DictionaryConceptItem } from '../../fixtures/dictionaryFixture';
import { useConceptDiscovery } from './useConceptDiscovery';

export interface DictionaryViewProps {
  initialConcepts?: DictionaryConceptItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  apiClient?: ApiClient;
}

export function DictionaryView({ initialConcepts = defaultDictionaryConcepts, forcedState = 'success', forcedErrorCode = 'INTERNAL_ERROR', apiClient }: DictionaryViewProps) {
  const discovery = useConceptDiscovery({ apiClient, initialConcepts });
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const handlePlayAudio = (id: string) => {
    setPlayingAudioId(id);
    setTimeout(() => setPlayingAudioId(null), 800);
  };

  const handleRetry = () => {
    setCurrentState('loading');
    setTimeout(() => setCurrentState('success'), 400);
  };

  if (currentState === 'loading') return <LoadingState message="Đang nạp dữ liệu từ điển và tra cứu ngữ cảnh..." count={3} />;
  if (currentState === 'error') return <ErrorState code={errorCode} onRetry={handleRetry} />;
  if (currentState === 'empty') return <EmptyState title="Không tìm thấy từ vựng" description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn." actionLabel="Xóa bộ lọc" onAction={discovery.clearSearch} />;

  return (
    <div className="mx-auto w-full min-w-0 max-w-6xl space-y-5 sm:space-y-7">
      <header className="min-w-0">
        <div className="lingua-kicker text-[var(--action-primary)]">Lexical Engine</div>
        <h1 className="mt-2 text-[28px] font-black leading-tight tracking-[-0.045em] text-[var(--text-primary)] sm:text-4xl">Từ điển & Tra cứu</h1>
        <p className="mt-2 max-w-2xl text-sm leading-6 text-[var(--text-secondary)] sm:text-[15px]">Tra cứu nghĩa, phát âm IPA, ví dụ thực tế và trạng thái của từ trong Language Brain.</p>
      </header>

      <section className="relative overflow-hidden rounded-[26px] border border-[var(--border-subtle)] bg-gradient-to-br from-white via-white to-[var(--accent-teal-soft)] p-3 shadow-[var(--shadow-card)] sm:p-5">
        <div className="pointer-events-none absolute -right-10 -top-14 h-40 w-40 rounded-full bg-[var(--surface-blue)] blur-2xl" />
        <div className="relative">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-[var(--text-muted)]" />
            <input
              type="search"
              placeholder="Nhập từ hoặc cụm từ..."
              value={discovery.searchQuery}
              onChange={(e) => discovery.setSearchQuery(e.target.value)}
              aria-label="Nhập từ vựng, cụm từ tiếng Anh..."
              className="min-h-[52px] w-full min-w-0 rounded-[18px] border border-[var(--border-default)] bg-white pl-12 pr-11 text-base font-medium text-[var(--text-primary)] shadow-sm outline-none transition-shadow placeholder:font-normal placeholder:text-[var(--text-muted)] focus:ring-2 focus:ring-[var(--focus-ring)]"
            />
            {discovery.searchQuery && <button type="button" onClick={discovery.clearSearch} className="absolute right-2.5 top-1/2 flex h-10 w-10 -translate-y-1/2 items-center justify-center rounded-xl text-[var(--text-muted)] hover:bg-[var(--surface-subtle)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)]" aria-label="Xóa từ khóa tìm kiếm"><X className="h-4 w-4" /></button>}
          </div>
          <div className="mt-3 flex flex-wrap items-center gap-2 text-xs text-[var(--text-muted)]"><span className="rounded-full bg-white/80 px-3 py-1.5">Nghĩa tiếng Việt</span><span className="rounded-full bg-white/80 px-3 py-1.5">IPA & từ loại</span><span className="rounded-full bg-white/80 px-3 py-1.5">Ví dụ ngữ cảnh</span></div>
        </div>
      </section>

      {discovery.saveError && <InlineAlert variant="danger" title="Không thể lưu từ vựng">{discovery.saveError.message}</InlineAlert>}
      {discovery.reconciliationError && <div className="space-y-2"><InlineAlert variant="danger" title="Lỗi đồng bộ kho từ vựng">{discovery.reconciliationError.message}</InlineAlert><Button variant="outline" size="sm" onClick={() => void discovery.retryReconciliation()} aria-label="Thử đồng bộ lại kho từ vựng"><RotateCcw className="mr-1.5 h-3.5 w-3.5" />Thử đồng bộ lại</Button></div>}
      {discovery.searchError && <div className="space-y-2"><InlineAlert variant="danger" title="Lỗi tra cứu từ điển">{discovery.searchError.message}</InlineAlert><Button variant="outline" size="sm" onClick={discovery.retrySearch}>Thử lại</Button></div>}
      {discovery.isSearching && <LoadingState message="Đang tra cứu từ điển..." count={2} />}

      {!discovery.isSearching && (
        <div className="grid min-w-0 grid-cols-1 gap-4 xl:grid-cols-2">
          {discovery.results.map((concept) => (
            <Card key={concept.id} padding="lg" className="min-w-0 overflow-hidden rounded-[26px]">
              <div className="flex min-w-0 flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0">
                  <div className="flex min-w-0 items-center gap-2">
                    <h2 className="truncate text-2xl font-black tracking-[-0.04em] text-[var(--text-primary)]">{concept.term}</h2>
                    <Button variant="ghost" size="icon" onClick={() => handlePlayAudio(concept.id)} aria-label={`Phát âm từ ${concept.term}`} className="h-10 w-10 shrink-0 rounded-2xl"><Volume2 className={`h-4 w-4 text-[var(--action-primary)] ${playingAudioId === concept.id ? 'animate-bounce' : ''}`} /></Button>
                  </div>
                  {(concept.ipa || concept.pos) && <span className="mt-1 block truncate font-mono text-xs text-[var(--text-muted)]">{[concept.ipa, concept.pos].filter(Boolean).join(' • ')}</span>}
                </div>
                <div className="flex shrink-0 flex-wrap items-center gap-2"><Badge variant="primary" size="sm">{concept.cefrLevel}</Badge><ConceptChip status={concept.status} isDue={concept.isDue} term={concept.term} size="sm" /></div>
              </div>

              <div className="mt-5 min-w-0">
                {concept.definitions && concept.definitions.length > 0 ? (
                  <div className="space-y-4">
                    {concept.definitions.map((def, idx) => (
                      <div key={idx} className="rounded-2xl bg-[var(--surface-subtle)] p-4">
                        <p className="font-bold leading-6 text-[var(--text-primary)]">{def.meaningVi}</p>
                        {def.explanationEn && <p className="mt-1 text-xs leading-5 text-[var(--text-muted)]">{def.explanationEn}</p>}
                        {def.examples && def.examples.length > 0 && <div className="mt-3 space-y-2 border-l-2 border-[var(--accent-teal)]/35 pl-3 text-xs">{def.examples.map((ex, exIdx) => <div key={exIdx} className="min-w-0"><p className="leading-5 text-[var(--text-primary)]">“{ex.source}”</p><p className="mt-0.5 leading-5 text-[var(--text-muted)]">→ {ex.target}</p></div>)}</div>}
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
          {discovery.results.length === 0 && <div className="xl:col-span-2"><EmptyState title="Không tìm thấy từ vựng" description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn." actionLabel="Xóa bộ lọc" onAction={discovery.clearSearch} /></div>}
        </div>
      )}
    </div>
  );
}
