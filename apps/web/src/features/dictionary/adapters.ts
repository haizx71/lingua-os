/**
 * Pure presentation adapters for Concept Discovery & Search.
 * Strictly DTO-to-view-model mapping; no learning algorithms, scoring, or client-side scheduling.
 */

import type { ConceptDetailDto, ConceptStatus, ConceptSummaryDto } from '@lingua/types';

export const partOfSpeechLabels: Readonly<Record<string, string>> = {
  noun: 'Danh từ',
  verb: 'Động từ',
  adjective: 'Tính từ',
  adverb: 'Trạng từ',
  preposition: 'Giới từ',
  conjunction: 'Liên từ',
  pronoun: 'Đại từ',
  interjection: 'Thán từ',
};

export interface ConceptDefinitionViewModel {
  readonly meaningVi: string;
  readonly explanationEn?: string;
  readonly examples?: readonly { readonly source: string; readonly target: string }[];
}

export interface ConceptSearchResultViewModel {
  readonly id: string;
  readonly term: string;
  readonly lemma: string;
  readonly pos?: string;
  readonly ipa: string;
  readonly cefrLevel: string;
  readonly status: ConceptStatus;
  readonly isDue: boolean;
  readonly audioUrl?: string;
  readonly isSaved: boolean;
  readonly primaryTranslationVi?: string;
  readonly definitions: readonly ConceptDefinitionViewModel[];
}

export function mapConceptSummaryToSearchResultViewModel(
  summary: ConceptSummaryDto,
  isSaved = false
): ConceptSearchResultViewModel {
  const posLabel = summary.partOfSpeech
    ? (partOfSpeechLabels[summary.partOfSpeech] ?? summary.partOfSpeech)
    : undefined;

  return {
    id: summary.id,
    term: summary.canonicalForm,
    lemma: summary.canonicalForm,
    ...(posLabel ? { pos: posLabel } : {}),
    ipa: summary.ipa ?? '',
    cefrLevel: summary.level?.code ?? '—',
    status: summary.status,
    isDue: summary.isDue,
    ...(summary.audioUrl ? { audioUrl: summary.audioUrl } : {}),
    isSaved,
    definitions: [],
  };
}

export function mapConceptDetailToSearchResultViewModel(
  detail: ConceptDetailDto,
  isSaved = false
): ConceptSearchResultViewModel {
  const posLabel = detail.partOfSpeech
    ? (partOfSpeechLabels[detail.partOfSpeech] ?? detail.partOfSpeech)
    : undefined;

  const primaryTranslationVi =
    detail.definitions[0]?.translation ?? detail.definitions[0]?.definition ?? '';

  return {
    id: detail.id,
    term: detail.canonicalForm,
    lemma: detail.canonicalForm,
    ...(posLabel ? { pos: posLabel } : {}),
    ipa: detail.ipa ?? '',
    cefrLevel: detail.level?.code ?? '—',
    status: detail.learner.status,
    isDue: detail.learner.isDue,
    ...(detail.audioUrl ? { audioUrl: detail.audioUrl } : {}),
    isSaved,
    primaryTranslationVi,
    definitions: detail.definitions.map((d) => ({
      meaningVi: d.translation ?? d.definition,
      explanationEn: d.definition,
      examples: detail.examples.map((ex) => ({
        source: ex.text,
        target: ex.translation ?? '',
      })),
    })),
  };
}
