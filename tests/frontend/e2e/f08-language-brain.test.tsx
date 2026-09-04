import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import BrainPage from '@/app/brain/page';
import { LanguageBrainCanvas } from '@/features/brain/LanguageBrainCanvas';
import {
  mapBrainConceptToViewModel,
  mockBrainConceptSummary,
  mockGrammarConceptSummary,
} from '@lingua/types';
import { renderWithProviders } from '../harness/test-render';
import { assertProgressbarA11y } from '../harness/a11y-helpers';

describe('Tier 1: Feature 08 - Language Brain Graph & Memory Model', () => {
  it('test_brain_page_renders_header_and_learner_state_model_subhead', () => {
    renderWithProviders(<BrainPage />);

    expect(screen.getByText('Learner State Model')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Language Brain của bạn/i })).toBeInTheDocument();
    expect(
      screen.getByText(/Bản đồ ghi nhớ thể hiện toàn bộ bằng chứng nhận diện, nghe và sử dụng/i)
    ).toBeInTheDocument();
  });

  it('test_brain_page_renders_mastered_concepts_metric_card', () => {
    renderWithProviders(<BrainPage />);

    expect(screen.getByText('Đã vững (Mastered)')).toBeInTheDocument();
    expect(screen.getByText('483')).toBeInTheDocument();
    expect(screen.getByText('Trí nhớ dài hạn FSRS')).toBeInTheDocument();
  });

  it('test_brain_page_renders_learning_and_weak_metrics', () => {
    renderWithProviders(<BrainPage />);

    expect(screen.getByText('Đang học (Learning)')).toBeInTheDocument();
    expect(screen.getByText('71')).toBeInTheDocument();

    expect(screen.getByText('Cần ôn (Weak / Due)')).toBeInTheDocument();
    expect(screen.getByText('28')).toBeInTheDocument();
  });

  it('test_brain_page_renders_overall_memory_health_score', () => {
    renderWithProviders(<BrainPage />);

    expect(screen.getByText('Sức khỏe trí nhớ')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('test_brain_page_renders_tri_dimensional_skill_evidence_bars', () => {
    renderWithProviders(<BrainPage />);

    expect(
      screen.getByRole('heading', { level: 2, name: /Bằng chứng năng lực theo chiều kỹ năng/i })
    ).toBeInTheDocument();

    const progressbars = screen.getAllByRole('progressbar');
    expect(progressbars.length).toBe(3);

    // Reading Recognition (72%)
    assertProgressbarA11y(progressbars[0], 72, 100);
    // Listening Recognition (54%)
    assertProgressbarA11y(progressbars[1], 54, 100);
    // Production Ability (38%)
    assertProgressbarA11y(progressbars[2], 38, 100);
  });

  it('test_brain_detail_omits_pos_metadata_for_non_lexical_concepts', () => {
    const grammar = mapBrainConceptToViewModel(
      { ...mockBrainConceptSummary, concept: mockGrammarConceptSummary },
      'Thì hiện tại hoàn thành'
    );
    renderWithProviders(<LanguageBrainCanvas initialNodes={[grammar]} />);

    fireEvent.click(screen.getByRole('button', { name: /present-perfect/i }));

    const dialog = screen.getByRole('dialog', { name: 'Chi tiết khái niệm' });
    expect(within(dialog).getByRole('heading', { name: 'present-perfect' })).toBeInTheDocument();
    expect(dialog.textContent).not.toMatch(/undefined|unknown|other|n\/a|•/i);
  });
});
