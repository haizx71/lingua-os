'use client';

import React, { useState } from 'react';
import { Button, Card, InlineAlert } from '@lingua/ui';
import { mapApiErrorToUi, type ApiClient } from '@lingua/types';
import {
  deleteAdminSentenceConcept,
  putAdminSentenceConcept,
  searchAdminConcepts,
  type AdminCatalogConceptViewModel,
  type AdminContentViewModel,
  type AdminSentenceViewModel,
} from './adapters';

interface TextSpan {
  readonly startOffset: number;
  readonly endOffset: number;
  readonly surfaceText: string;
}

export function AdminSentenceConceptEditor({
  apiClient,
  content,
  sentence,
  onContent,
}: {
  apiClient: ApiClient;
  content: AdminContentViewModel;
  sentence: AdminSentenceViewModel;
  onContent(value: AdminContentViewModel): void;
}) {
  const editable = !['published', 'retired'].includes(content.status);
  const [selection, setSelection] = useState<TextSpan | null>(null);
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<readonly AdminCatalogConceptViewModel[] | null>(null);
  const [role, setRole] = useState<'target' | 'context' | 'grammar'>('target');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function captureSelection(event: React.MouseEvent<HTMLParagraphElement>) {
    if (!editable) return;
    const browserSelection = window.getSelection();
    if (!browserSelection || browserSelection.rangeCount !== 1 || browserSelection.isCollapsed) {
      setSelection(null);
      return;
    }
    const range = browserSelection.getRangeAt(0);
    const root = event.currentTarget;
    if (!root.contains(range.startContainer) || !root.contains(range.endContainer)) return;
    const prefix = document.createRange();
    prefix.selectNodeContents(root);
    prefix.setEnd(range.startContainer, range.startOffset);
    const startOffset = prefix.toString().length;
    const surfaceText = range.toString();
    if (!surfaceText.trim()) return;
    setSelection({
      startOffset,
      endOffset: startOffset + surfaceText.length,
      surfaceText,
    });
  }

  async function search(event: React.FormEvent) {
    event.preventDefault();
    if (busy || !query.trim()) return;
    setBusy(true);
    setError(null);
    try {
      setResults(await searchAdminConcepts(apiClient, query.trim()));
    } catch (reason) {
      setError(mapApiErrorToUi(reason).message);
    } finally {
      setBusy(false);
    }
  }

  async function add(concept: AdminCatalogConceptViewModel) {
    if (!selection || busy) return;
    setBusy(true);
    setError(null);
    try {
      onContent(await putAdminSentenceConcept(apiClient, {
        contentId: content.id,
        sentenceId: sentence.id,
        conceptId: concept.id,
        body: {
          startOffset: selection.startOffset,
          endOffset: selection.endOffset,
          occurrenceRole: role,
        },
      }));
      setSelection(null);
      setResults(null);
    } catch (reason) {
      setError(mapApiErrorToUi(reason).message);
    } finally {
      setBusy(false);
    }
  }

  async function remove(conceptId: string, startOffset: number, endOffset: number) {
    if (busy) return;
    setBusy(true);
    setError(null);
    try {
      onContent(await deleteAdminSentenceConcept(apiClient, {
        contentId: content.id,
        sentenceId: sentence.id,
        conceptId,
        startOffset,
        endOffset,
      }));
    } catch (reason) {
      setError(mapApiErrorToUi(reason).message);
    } finally {
      setBusy(false);
    }
  }

  return (
    <Card className="space-y-3 p-4">
      <div>
        <p
          aria-label={`Văn bản câu ${sentence.order + 1}`}
          className={editable ? 'cursor-text select-text' : undefined}
          onMouseUp={captureSelection}
        >
          {sentence.text}
        </p>
        <p className="mt-1 text-xs text-[var(--text-secondary)]">
          Câu {sentence.order + 1} · {sentence.conceptCount} concept đã đối chiếu
        </p>
      </div>

      {sentence.concepts.length === 0 ? (
        <p className="text-sm font-medium text-[var(--status-warning)]">Chưa ánh xạ concept</p>
      ) : (
        <ul aria-label={`Concept của câu ${sentence.order + 1}`} className="space-y-2">
          {sentence.concepts.map((occurrence) => (
            <li key={`${occurrence.concept.id}:${occurrence.startOffset}:${occurrence.endOffset}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[var(--border-subtle)] p-2 text-sm">
              <span>
                <strong>{occurrence.surfaceText}</strong> → {occurrence.concept.canonicalForm}
                {occurrence.concept.partOfSpeech ? ` · ${occurrence.concept.partOfSpeech}` : ''}
                {' · '}{occurrence.occurrenceRole} · [{occurrence.startOffset}, {occurrence.endOffset})
              </span>
              {editable && (
                <Button variant="outline" disabled={busy} onClick={() => void remove(occurrence.concept.id, occurrence.startOffset, occurrence.endOffset)}>
                  Gỡ {occurrence.concept.canonicalForm}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="space-y-2 border-t border-[var(--border-subtle)] pt-3">
          <p className="text-sm text-[var(--text-secondary)]">
            {selection
              ? <>Đoạn đã chọn: <strong>{selection.surfaceText}</strong> [{selection.startOffset}, {selection.endOffset})</>
              : 'Bôi đen chính xác đoạn chữ cần gắn concept trước khi thêm.'}
          </p>
          <form className="flex flex-wrap gap-2" onSubmit={(event) => void search(event)}>
            <label className="min-w-52 flex-1 text-sm">
              <span className="sr-only">Tìm concept cho câu {sentence.order + 1}</span>
              <input
                aria-label={`Tìm concept cho câu ${sentence.order + 1}`}
                className="w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2"
                maxLength={120}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Tìm lemma, biến thể hoặc canonical key"
                value={query}
              />
            </label>
            <label className="text-sm">
              <span className="sr-only">Vai trò occurrence</span>
              <select aria-label={`Vai trò concept câu ${sentence.order + 1}`} className="rounded-lg border border-[var(--border-default)] bg-[var(--surface)] px-3 py-2" onChange={(event) => setRole(event.target.value as typeof role)} value={role}>
                <option value="target">Từ/cụm từ đích</option>
                <option value="context">Ngữ cảnh</option>
                <option value="grammar">Ngữ pháp</option>
              </select>
            </label>
            <Button variant="outline" disabled={busy || !query.trim()} type="submit">Tìm</Button>
          </form>
          {results?.length === 0 && <p className="text-sm">Không có concept catalog phù hợp. Câu vẫn chưa được ánh xạ.</p>}
          {results && results.length > 0 && (
            <ul aria-label={`Kết quả concept cho câu ${sentence.order + 1}`} className="space-y-2">
              {results.map((concept) => (
                <li key={concept.id} className="flex items-start justify-between gap-3 rounded-lg bg-[var(--surface-subtle)] p-3 text-sm">
                  <span>
                    <strong>{concept.canonicalForm}</strong> · {concept.conceptType}
                    {concept.partOfSpeech ? ` · ${concept.partOfSpeech}` : ''}
                    {concept.definition && <span className="block text-[var(--text-secondary)]">{concept.definition}</span>}
                  </span>
                  <Button disabled={busy || !selection} onClick={() => void add(concept)}>Thêm {concept.canonicalForm}</Button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      {error && <InlineAlert variant="danger" title="Không thể cập nhật concept">{error}</InlineAlert>}
    </Card>
  );
}
