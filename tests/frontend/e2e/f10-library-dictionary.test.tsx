import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import DictionaryPage from '@/app/dictionary/page';
import { DictionaryView } from '@/features/dictionary/DictionaryView';
import { LibraryView } from '@/features/library/LibraryView';
import { defaultDictionaryConcepts } from '@/fixtures/dictionaryFixture';
import { mapConceptDetailToDictionaryViewModel, mockGrammarConceptDetail } from '@lingua/types';
import { renderWithProviders } from '../harness/test-render';
import { assertEmptyState } from '../harness/state-helpers';

describe('Tier 1: Feature 10 - Library & Dictionary', () => {
  it('test_dictionary_renders_header_and_search_input', () => {
    renderWithProviders(<DictionaryPage />);

    expect(screen.getByText('Lexical Engine')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Từ điển & Tra cứu/i })).toBeInTheDocument();

    const searchInput = screen.getByPlaceholderText(/Nhập từ vựng, cụm từ tiếng Anh\.\.\./i);
    expect(searchInput).toBeInTheDocument();
  });

  it('test_dictionary_displays_concept_card_with_ipa_and_vietnamese_definition', () => {
    renderWithProviders(<DictionaryView initialConcepts={defaultDictionaryConcepts} />);

    expect(screen.getByRole('heading', { level: 2, name: 'appointment' })).toBeInTheDocument();
    expect(screen.getByText(/\/əˈpɔɪnt\.mənt\/ • Danh từ/i)).toBeInTheDocument();
    expect(
      screen.getByText(/1\. Cuộc hẹn chính thức \(với bác sĩ, đối tác, khách hàng\)\./i)
    ).toBeInTheDocument();
  });

  it('test_dictionary_displays_concept_status_chip', () => {
    renderWithProviders(<DictionaryView initialConcepts={defaultDictionaryConcepts} />);

    const chip = screen.getAllByRole('status')[0];
    expect(chip).toBeInTheDocument();
    expect(chip.textContent).toContain('appointment');
  });

  it('test_dictionary_omits_pos_metadata_for_non_lexical_concepts', () => {
    const grammar = mapConceptDetailToDictionaryViewModel(mockGrammarConceptDetail);

    const { container } = renderWithProviders(<DictionaryView initialConcepts={[grammar]} />);

    expect(screen.getByRole('heading', { level: 2, name: 'present-perfect' })).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/undefined|unknown|other|n\/a/i);
    expect(container.querySelectorAll('span.font-mono')).toHaveLength(0);
  });

  it('test_library_renders_header_and_empty_state_guidance', () => {
    renderWithProviders(<LibraryView forcedState="empty" />);

    expect(screen.getByText('Content & Sentences')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Thư viện của bạn/i })).toBeInTheDocument();

    assertEmptyState('Chưa có bài đọc nào được lưu', 'Đọc bài trong Reader');
  });

  it('test_library_empty_state_action_button_renders_properly', () => {
    renderWithProviders(<LibraryView forcedState="empty" />);

    const ctaBtn = screen.getByRole('button', { name: /Đọc bài trong Reader/i });
    expect(ctaBtn).toBeInTheDocument();
  });
});
