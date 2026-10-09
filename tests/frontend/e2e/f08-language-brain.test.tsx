import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, screen, within } from '@testing-library/react';
import { LanguageBrainCanvas } from '@/features/brain/LanguageBrainCanvas';
import {
  mapBrainConceptToViewModel,
  mapBrainSummaryToViewModel,
  mockBrainConceptSummary,
  mockGrammarConceptSummary,
  mockApiResponses,
  type BrainSummaryDto,
} from '@lingua/types';
import { renderWithProviders } from '../harness/test-render';
import { assertProgressbarA11y } from '../harness/a11y-helpers';

const presentationSummaryDto: BrainSummaryDto = {
  ...mockApiResponses.brainSummary.data,
  statusCounts: {
    ...mockApiResponses.brainSummary.data.statusCounts,
    learning: 71,
    mastered: 483,
    weak: 28,
  },
  memoryHealth: 0.87,
  competence: {
    ...mockApiResponses.brainSummary.data.competence,
    recognition: { ...mockApiResponses.brainSummary.data.competence.recognition, score: 0.72 },
    listening: { ...mockApiResponses.brainSummary.data.competence.listening, score: 0.54 },
    production: { ...mockApiResponses.brainSummary.data.competence.production, score: 0.38 },
  },
};
const presentationSummary = mapBrainSummaryToViewModel(presentationSummaryDto);
const presentationNodes = [mapBrainConceptToViewModel(mockBrainConceptSummary, 'Cuộc hẹn chính thức')];

function renderPresentationBrain() {
  return renderWithProviders(
    <LanguageBrainCanvas initialNodes={presentationNodes} summary={presentationSummary} state="success" />
  );
}

describe('Tier 1: Feature 08 - Language Brain Graph & Memory Model', () => {
  it('uses a concise learner-facing Brain heading and description', () => {
    renderPresentationBrain();

    expect(screen.getByText('Tổng quan ngôn ngữ')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Language Brain' })).toBeInTheDocument();
    expect(screen.getByText('Xem các khái niệm đã gặp và trạng thái ghi nhớ được ghi nhận.')).toBeInTheDocument();
  });

  it('test_brain_page_renders_mastered_concepts_metric_card', () => {
    renderPresentationBrain();

    const statusSummary = screen.getByRole('region', { name: 'Trạng thái khái niệm' });
    const masteredCard = within(statusSummary).getByText('Đã vững').closest('div');
    expect(masteredCard).not.toBeNull();
    expect(within(masteredCard as HTMLElement).getByText('483')).toBeInTheDocument();
    expect(screen.getByText('Tổng khái niệm')).toBeInTheDocument();
  });

  it('test_brain_page_renders_learning_and_weak_metrics', () => {
    renderPresentationBrain();

    const statusSummary = screen.getByRole('region', { name: 'Trạng thái khái niệm' });
    const learningCard = within(statusSummary).getByText('Đang học').closest('div');
    expect(learningCard).not.toBeNull();
    expect(within(learningCard as HTMLElement).getByText('71')).toBeInTheDocument();
    const weakCard = within(statusSummary).getByText('Cần củng cố').closest('div');
    expect(weakCard).not.toBeNull();
    expect(within(weakCard as HTMLElement).getByText('28')).toBeInTheDocument();
  });

  it('test_brain_page_renders_overall_memory_health_score', () => {
    renderPresentationBrain();

    expect(screen.getByText('Sức khỏe ghi nhớ')).toBeInTheDocument();
    expect(screen.getByText('87%')).toBeInTheDocument();
  });

  it('test_brain_page_renders_tri_dimensional_skill_evidence_bars', () => {
    renderPresentationBrain();

    expect(
      screen.getByRole('heading', { level: 2, name: 'Bằng chứng theo kỹ năng' })
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
