'use client';

import React, { useState, useMemo } from 'react';
import Link from 'next/link';
import {
  Card,
  Button,
  ConceptChip,
  Badge,
  LoadingState,
  EmptyState,
  ErrorState,
} from '@lingua/ui';
import {
  Search,
  BookOpen,
  Volume2,
  Sparkles,
  ExternalLink,
  Plus,
  Check,
  X,
} from 'lucide-react';
import { type ConceptStatus, type ApiErrorCode } from '@lingua/types';
import { defaultDictionaryConcepts, type DictionaryConceptItem } from '../../fixtures/dictionaryFixture';

export interface DictionaryViewProps {
  initialConcepts?: DictionaryConceptItem[];
  forcedState?: 'loading' | 'empty' | 'error' | 'success';
  forcedErrorCode?: ApiErrorCode;
}

export function DictionaryView({
  initialConcepts = defaultDictionaryConcepts,
  forcedState = 'success',
  forcedErrorCode = 'INTERNAL_ERROR',
}: DictionaryViewProps) {
  const [concepts] = useState<DictionaryConceptItem[]>(initialConcepts);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [currentState, setCurrentState] = useState<'loading' | 'empty' | 'error' | 'success'>(forcedState);
  const [errorCode] = useState<ApiErrorCode>(forcedErrorCode);
  const [playingAudioId, setPlayingAudioId] = useState<string | null>(null);

  const filteredConcepts = useMemo(() => {
    if (!searchQuery.trim()) {
      return concepts;
    }
    const q = searchQuery.toLowerCase().trim();
    return concepts.filter(
      (c) =>
        c.term.toLowerCase().includes(q) ||
        c.lemma.toLowerCase().includes(q) ||
        c.primaryTranslationVi.toLowerCase().includes(q) ||
        c.definitions.some((d) => d.meaningVi.toLowerCase().includes(q))
    );
  }, [concepts, searchQuery]);

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
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-12 pr-10 py-3 rounded-xl border border-[var(--border-default)] bg-[var(--surface)] text-[var(--text-primary)] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--focus-ring)] shadow-sm"
        />
        {searchQuery && (
          <button
            type="button"
            onClick={() => setSearchQuery('')}
            className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-[var(--text-muted)] hover:text-[var(--text-primary)]"
            aria-label="Xóa từ khóa tìm kiếm"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Search Results / Concept Cards List */}
      <div className="space-y-4">
        {filteredConcepts.map((concept) => (
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

            {/* Definitions */}
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
                          <p className="text-[var(--text-primary)]">"{ex.source}"</p>
                          <p className="text-[var(--text-muted)] not-italic">→ {ex.target}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
            </div>

          </Card>
        ))}

        {filteredConcepts.length === 0 && (
          <EmptyState
            title="Không tìm thấy từ vựng"
            description="Không có kết quả nào khớp với từ khóa tìm kiếm của bạn."
            actionLabel="Xóa bộ lọc"
            onAction={() => setSearchQuery('')}
          />
        )}
      </div>
    </div>
  );
}
