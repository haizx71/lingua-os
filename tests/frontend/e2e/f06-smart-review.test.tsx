import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ReviewPage from '@/app/review/page';
import { ReviewSession } from '@/features/review/ReviewSession';
import { defaultReviewQueue } from '@/fixtures/reviewFixture';
import { renderWithProviders } from '../harness/test-render';
import { assertProgressbarA11y, assertTouchTargetSize } from '../harness/a11y-helpers';

describe('Tier 1: Feature 06 - Smart Review (FSRS Algorithm & Ratings)', () => {
  it('test_smart_review_renders_header_with_due_count_badge', () => {
    renderWithProviders(<ReviewPage />);

    expect(screen.getByText('Smart Review (FSRS)')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Hàng đợi ôn tập/i })).toBeInTheDocument();
    expect(screen.getByText('23 từ đến hạn')).toBeInTheDocument();
  });

  it('test_smart_review_renders_session_progress_bar', () => {
    renderWithProviders(<ReviewPage />);

    const progressbar = screen.getByRole('progressbar');
    assertProgressbarA11y(progressbar, 0, 100);
    expect(screen.getByText(/0 \/ 23 thẻ/i)).toBeInTheDocument();
  });

  it('test_smart_review_renders_flashcard_prompt_and_pronunciation_audio_button', () => {
    renderWithProviders(<ReviewPage />);

    expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
    expect(screen.getByText(/\/əˈpɔɪnt\.mənt\//i)).toBeInTheDocument();

    const audioBtn = screen.getByRole('button', { name: /Phát âm từ/i });
    expect(audioBtn).toBeInTheDocument();
    assertTouchTargetSize(audioBtn, 44);
  });

  it('test_smart_review_renders_all_4_fsrs_rating_buttons', () => {
    renderWithProviders(<ReviewPage />);

    const againBtn = screen.getByRole('button', { name: /Quên \(Again\)/i });
    const hardBtn = screen.getByRole('button', { name: /Khó \(Hard\)/i });
    const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
    const easyBtn = screen.getByRole('button', { name: /Dễ \(Easy\)/i });

    expect(againBtn).toBeInTheDocument();
    expect(hardBtn).toBeInTheDocument();
    expect(goodBtn).toBeInTheDocument();
    expect(easyBtn).toBeInTheDocument();
  });

  it('test_smart_review_renders_fsrs_due_concept_status_chip', () => {
    renderWithProviders(<ReviewPage />);

    const dueChip = screen.getByRole('status');
    expect(dueChip).toBeInTheDocument();
    expect(dueChip.textContent).toContain('appointment');
  });

  it('test_smart_review_renders_typing_prompt_without_leaking_the_target', () => {
    const typingCard = {
      ...defaultReviewQueue[0],
      exerciseMode: 'typing' as const,
      prompt: 'Một cuộc hẹn.',
      meaningVi: 'Một cuộc hẹn.',
    };

    renderWithProviders(<ReviewSession initialQueue={[typingCard]} />);

    expect(screen.getByRole('textbox', { name: 'Câu trả lời' })).toBeInTheDocument();
    expect(screen.getByText('Gõ từ')).toBeInTheDocument();
    expect(screen.queryByText('appointment')).not.toBeInTheDocument();
  });

  it('test_smart_review_renders_non_lexical_concept_without_fake_pos_or_empty_parentheses', () => {
    const [{ pos: _pos, ...baseCard }] = defaultReviewQueue;
    const nonLexicalCard = {
      ...baseCard,
      id: 'review-grammar',
      conceptId: 'concept-grammar',
      term: 'present-perfect',
      ipa: '',
    };

    const { container } = renderWithProviders(<ReviewSession initialQueue={[nonLexicalCard]} />);

    expect(screen.getAllByText('present-perfect').length).toBeGreaterThan(0);
    expect(screen.getByText('Khái niệm tiếng Anh')).toBeInTheDocument();
    expect(container.textContent).not.toMatch(/unknown|other|n\/a|\(\s*\)/i);
  });
});
