'use client';

import React, { useState } from 'react';
import {
  Card,
  Button,
  ConceptChip,
  Badge,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
} from '@lingua/ui';
import {
  Search,
  Volume2,
  Plus,
  Check,
  X,
  ChevronDown,
  RotateCcw,
} from 'lucide-react';
import { type ApiErrorCode, type ApiClient } from '@lingua/types';
import { defaultDictionaryConcepts, type DictionaryConceptItem } from '../../fixtures/dictionaryFixture';
import { useConceptDiscovery } from './useConceptDiscovery';

export interface DictionaryViewProps {
  initialConcepts?: DictionaryConceptItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
  apiClient?: ApiClient;
}

export function DictionaryView({
  initialConcepts = defaultDictionaryConcepts,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
  apiClient,
}: DictionaryViewProps) {
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
    setTimeout(() => {
      setCurrentState('success');
    }, 400);
  };

  if (currentState === 'loading') {
    return <LoadingState message="Đang nạp dữ liệu từ điển và tra cứu ngữ cảnh..." count={3} />;
  }

  if (currentState === 'error') {
    return <ErrorState code={errorCode} onRetry={handleRetry} />;
  }

  if (currentState === 'empty') {
    return (
      <EmptyState
        title="Không tìm thấy từ vựng"
        description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn."
        actionLabel="Xóa bộ lọc"
        onAction={discovery.clearSearch}
      />
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <header>
        <span className="text-xs font-semibold uppercase tracking-wider text-[var(--action-primary)]">
          Lexical Engine
        </span>
        <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[var(--text-primary)] mt-1">
          Từ điển & Tra cứu
        </h1>
        <p className="text-sm text-[var(--text-secondary)] mt-1">
          Tra cứu nghĩa, phát âm IPA, ví dụ thực tế và trạng thái của từ trong Language Brain.
        </p>
      </header>

      {/* Search Input Box */}
      <div className="relative max-w-xl">
        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-[var(--text-muted)]" />
        <input
          type="search"
          placeholder="Nhập từ vựng, cụm từ tiếng Anh..."
          value={discovery.searchQuery}
          onChange={(e) => discovery.setSearchQuery(e.target.value)}
          aria-label="Nhập từ vựng, cụm từ tiếng Anh..."
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] shadow-sm"
        />
        {discovery.searchQuery && (
          <button
            type="button"
            onClick={discovery.clearSearch}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Save Error Alert */}
      {discovery.saveError && (
        <div className="max-w-xl">
          <InlineAlert variant="danger" title="Không thể lưu từ vựng">
            {discovery.saveError.message}
          </InlineAlert>
        </div>
      )}

      {/* Reconciliation Error Alert */}
      {discovery.reconciliationError && (
        <div className="max-w-xl space-y-2">
          <InlineAlert variant="danger" title="Lỗi đồng bộ kho từ vựng">
            {discovery.reconciliationError.message}
          </InlineAlert>
          <Button
            variant="outline"
            size="sm"
            onClick={() => void discovery.retryReconciliation()}
            aria-label="Thử đồng bộ lại kho từ vựng"
          >
            <RotateCcw className="w-3.5 h-3.5 mr-1.5" />
            Thử đồng bộ lại
          </Button>
        </div>
      )}

      {/* Search Error Alert */}
      {discovery.searchError && (
        <div className="max-w-xl space-y-2">
          <InlineAlert variant="danger" title="Lỗi tra cứu từ điển">
            {discovery.searchError.message}
          </InlineAlert>
          <Button variant="outline" size="sm" onClick={discovery.retrySearch}>
            Thử lại
          </Button>
        </div>
      )}

      {/* Searching State */}
      {discovery.isSearching && (
        <LoadingState message="Đang tra cứu từ điển..." count={2} />
      )}

      {/* Search Results / Concept Cards List */}
      {!discovery.isSearching && (
        <div className="space-y-4">
          {discovery.results.map((concept) => (
            <Card key={concept.id} variant="default" padding="lg" className="space-y-3">
              <div className="flex justify-between items-start">
                <div>
                  <div className="flex items-center gap-3">
                    <h2 className="text-xl font-bold text-[var(--text-primary)]">
                      {concept.term}
                    </h2>
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => handlePlayAudio(concept.id)}
                      aria-label={`Phát âm từ ${concept.term}`}
                      className="w-8 h-8 rounded-full"
                    >
                      <Volume2
                        className={`w-4 h-4 text-[var(--action-primary)] ${
                          playingAudioId === concept.id ? 'animate-bounce' : ''
                        }`}
                      />
                    </Button>
                  </div>
                  {(concept.ipa || concept.pos) && (
                    <span className="text-xs text-[var(--text-muted)] font-mono">
                      {[concept.ipa, concept.pos].filter(Boolean).join(' • ')}
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="primary" size="sm">
                    {concept.cefrLevel}
                  </Badge>
                  <ConceptChip status={concept.status} isDue={concept.isDue} term={concept.term} size="sm" />
                </div>
              </div>

              {/* Definitions and Examples */}
              {concept.definitions && concept.definitions.length > 0 ? (
                <div className="space-y-2 text-sm text-[var(--text-secondary)]">
                  {concept.definitions.map((def, idx) => (
                    <div key={idx}>
                      <p className="font-medium text-[var(--text-primary)]">
                        {def.meaningVi}
                      </p>
                      {def.explanationEn && (
                        <p className="text-xs text-[var(--text-muted)] mt-0.5">{def.explanationEn}</p>
                      )}
                      {def.examples && def.examples.length > 0 && (
                        <div className="mt-2 pl-3 border-l-2 border-[var(--border-subtle)] text-xs italic space-y-1">
                          {def.examples.map((ex, exIdx) => (
                            <div key={exIdx}>
                              <p className="text-[var(--text-primary)]">&ldquo;{ex.source}&rdquo;</p>
                              <p className="text-[var(--text-muted)] not-italic">→ {ex.target}</p>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="pt-1">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => void discovery.inspectConcept(concept.id)}
                    disabled={discovery.isInspecting(concept.id)}
                    aria-label={`Xem chi tiết từ ${concept.term}`}
                  >
                    <ChevronDown className="w-3.5 h-3.5 mr-1" />
                    {discovery.isInspecting(concept.id) ? 'Đang tải chi tiết...' : 'Xem chi tiết & ví dụ'}
                  </Button>
                </div>
              )}

              {/* Card Footer: Save/Learn CTA */}
              <div className="pt-3 border-t border-[var(--border-subtle)] flex items-center justify-between gap-2">
                <span className="text-xs text-[var(--text-muted)]">
                  {concept.definitions && concept.definitions.length > 0
                    ? 'Định nghĩa ngữ nghĩa'
                    : 'Nhấn để xem chi tiết nghĩa'}
                </span>

                <div>
                  {discovery.isSaved(concept.id) ? (
                    <span
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-[var(--status-success-bg,#ECFDF5)] text-[var(--status-success,#059669)] border border-[var(--status-success-border,#D1FAE5)]"
                      aria-label={`Đã lưu từ ${concept.term} vào kho học`}
                    >
                      <Check className="w-4 h-4" />
                      Đã lưu vào kho học
                    </span>
                  ) : discovery.isSaving(concept.id) ? (
                    <Button
                      variant="primary"
                      size="sm"
                      disabled
                      aria-busy="true"
                      aria-label={`Đang lưu từ ${concept.term}`}
                    >
                      Đang lưu...
                    </Button>
                  ) : discovery.reconciliationError ? (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => void discovery.retryReconciliation()}
                      aria-label={`Thử đồng bộ lại trạng thái lưu của từ ${concept.term}`}
                    >
                      <RotateCcw className="w-3.5 h-3.5 mr-1" />
                      Thử đồng bộ lại
                    </Button>
                  ) : !discovery.isSavedStateReady ? (
                    <Button
                      variant="outline"
                      size="sm"
                      disabled
                      aria-busy="true"
                      aria-label={`Đang kiểm tra trạng thái lưu của từ ${concept.term}`}
                    >
                      Đang kiểm tra...
                    </Button>
                  ) : (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => void discovery.saveConcept(concept.id)}
                      aria-label={`Lưu từ ${concept.term} để học`}
                    >
                      <Plus className="w-4 h-4 mr-1.5" />
                      Lưu để học
                    </Button>
                  )}
                </div>
              </div>
            </Card>
          ))}

          {discovery.results.length === 0 && (
            <EmptyState
              title="Không tìm thấy từ vựng"
              description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn."
              actionLabel="Xóa bộ lọc"
              onAction={discovery.clearSearch}
            />
          )}
        </div>
      )}
    </div>
  );
}
