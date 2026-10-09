import React from 'react';
import { describe, it, expect } from 'vitest';
import { fireEvent, screen } from '@testing-library/react';
import { InteractiveReader } from '@/features/read/InteractiveReader';
import { defaultReaderPassage } from '@/fixtures/readerFixture';
import { renderWithProviders } from '../harness/test-render';
import { assertTouchTargetSize } from '../harness/a11y-helpers';

describe('Tier 1: Feature 07 - Interactive Reader & Word Inspector', () => {
  const presentationPassage = {
    ...defaultReaderPassage,
    audioUrl: 'https://example.test/reader-audio.mp3',
  };

  it('uses the current article title as the page heading and exposes save/library actions', () => {
    renderWithProviders(<InteractiveReader passage={presentationPassage} />);

    expect(screen.getByRole('heading', { level: 1, name: 'Making an Appointment' })).toBeInTheDocument();
    expect(screen.getByText('CEFR A2 · 180 từ')).toBeInTheDocument();
    const savedContentButton = screen.getByRole('button', { name: 'Đã lưu bài đọc' });
    expect(savedContentButton).toBeDisabled();
    expect(screen.getByRole('link', { name: 'Thư viện' })).toHaveAttribute('href', '/library');
  });

  it('keeps supplied sentence translations hidden until the learner asks to see them', () => {
    renderWithProviders(<InteractiveReader passage={presentationPassage} />);

    const translation = defaultReaderPassage.sentences[0].translationVi;
    expect(screen.queryByText(translation)).not.toBeInTheDocument();

    fireEvent.click(screen.getAllByRole('button', { name: 'Xem nghĩa câu' })[0]);
    expect(screen.getByText(translation)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: 'Ẩn nghĩa câu' }));
    expect(screen.queryByText(translation)).not.toBeInTheDocument();
  });

  it('does not offer sentence meaning when the content has no Vietnamese translation', () => {
    const passageWithoutTranslation = {
      ...presentationPassage,
      sentences: presentationPassage.sentences.map((sentence, index) => index === 0
        ? { ...sentence, translationVi: '' }
        : sentence),
      segments: presentationPassage.segments.map((segment) => ({
        ...segment,
        sentences: segment.sentences.map((sentence) => sentence.id === presentationPassage.sentences[0].id
          ? { ...sentence, translationVi: '' }
          : sentence),
      })),
    };
    renderWithProviders(<InteractiveReader passage={passageWithoutTranslation} />);

    expect(screen.queryByRole('button', { name: 'Xem nghĩa câu' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Lưu câu 1' })).toBeEnabled();
  });

  it('supports audio with a touch-sized accessible control', () => {
    renderWithProviders(<InteractiveReader passage={presentationPassage} />);

    const audioButton = screen.getByRole('button', { name: /Nghe toàn bài/i });
    expect(audioButton).toBeInTheDocument();
    assertTouchTargetSize(audioButton, 44);
  });

  it('exposes the concept state as an accessible description and in the word inspector', () => {
    renderWithProviders(<InteractiveReader passage={presentationPassage} />);

    const wordButton = screen.getByRole('button', { name: 'appointment' });
    expect(wordButton).toHaveAccessibleDescription(/Đang học/);
    fireEvent.click(wordButton);
    expect(screen.getByRole('status')).toHaveAccessibleName(/Đang học/);
  });

  it('keeps lookup keyboard dismissible and restores focus to the selected word', () => {
    renderWithProviders(<InteractiveReader passage={presentationPassage} />);

    const wordButton = screen.getAllByRole('button', { name: /appointment/i })[0];
    fireEvent.click(wordButton);

    const closeButton = screen.getByRole('button', { name: 'Đóng bảng tra từ' });
    expect(closeButton).toHaveFocus();
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(screen.queryByRole('dialog', { name: 'Chi tiết từ vựng' })).not.toBeInTheDocument();
    expect(wordButton).toHaveFocus();
  });
});
