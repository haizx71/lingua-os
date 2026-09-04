import React from 'react';
import { describe, it, expect } from 'vitest';
import { screen } from '@testing-library/react';
import ReadPage from '@/app/read/page';
import { renderWithProviders } from '../harness/test-render';
import { assertTouchTargetSize } from '../harness/a11y-helpers';

describe('Tier 1: Feature 07 - Interactive Reader & Word Inspector', () => {
  it('test_reader_renders_header_and_saved_articles_button', () => {
    renderWithProviders(<ReadPage />);

    expect(screen.getByText('Reader • Immersion')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: /Đọc & Tiếp nạp ngôn ngữ/i })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Bài đọc đã lưu/i })).toBeInTheDocument();
  });

  it('test_reader_renders_passage_title_cefr_badge_and_familiarity_rate', () => {
    renderWithProviders(<ReadPage />);

    expect(screen.getByRole('heading', { level: 2, name: /Making an Appointment/i })).toBeInTheDocument();
    expect(screen.getByText(/CEFR A2 • 180 từ • Tỷ lệ từ quen: 96%/i)).toBeInTheDocument();
  });

  it('test_reader_renders_full_audio_playback_button_with_accessible_label', () => {
    renderWithProviders(<ReadPage />);

    const audioBtn = screen.getByRole('button', { name: /Nghe toàn bài/i });
    expect(audioBtn).toBeInTheDocument();
    assertTouchTargetSize(audioBtn, 44);
  });

  it('test_reader_renders_tokenized_sentence_with_highlighted_target_words', () => {
    renderWithProviders(<ReadPage />);

    expect(screen.getByText(/I would like to make an/i)).toBeInTheDocument();
    expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
    expect(screen.getAllByText('available').length).toBeGreaterThan(0);
  });

  it('test_reader_renders_vietnamese_translation_and_target_concept_chips', () => {
    renderWithProviders(<ReadPage />);

    expect(
      screen.getByText(/Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai nếu ông ấy có thời gian/i)
    ).toBeInTheDocument();

    expect(screen.getByText('Từ vựng mục tiêu trong câu:')).toBeInTheDocument();
    const chips = screen.getAllByRole('status');
    expect(chips.length).toBeGreaterThanOrEqual(2);
  });
});
