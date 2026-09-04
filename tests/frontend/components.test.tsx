import React, { useState } from 'react';
import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import {
  Button,
  Card,
  Badge,
  ConceptChip,
  Progress,
  Skeleton,
  LoadingState,
  EmptyState,
  ErrorState,
  InlineAlert,
  Input,
  TextField,
  Modal,
  Dialog,
  Tabs,
  TabsList,
  TabsTrigger,
  TabsContent,
  Slider,
  Tooltip,
  Select,
  AudioPlayer,
  WordCard,
  ReviewCard,
  ReaderSentence,
  ConceptNode,
  BrainSummaryCard,
  SkillMeter,
} from '@lingua/ui';

describe('UI Primitives and Learning Domain Components', () => {
  describe('Button', () => {
    it('renders with children and handles click events', () => {
      const handleClick = vi.fn();
      render(<Button onClick={handleClick}>Bắt đầu</Button>);

      const button = screen.getByRole('button', { name: /Bắt đầu/i });
      expect(button).toBeInTheDocument();
      fireEvent.click(button);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });

    it('disables button and displays loading state when isLoading is true', () => {
      render(<Button isLoading>Đang lưu</Button>);
      const button = screen.getByRole('button');
      expect(button).toBeDisabled();
      expect(button).toHaveAttribute('aria-busy', 'true');
    });
  });

  describe('ConceptChip (Non-color accessibility invariant)', () => {
    it('renders text label, icon, and accessible status role for mastered state', () => {
      render(<ConceptChip status="mastered" term="appointment" />);
      const chip = screen.getByRole('status');
      expect(chip).toBeInTheDocument();
      expect(screen.getByText('appointment')).toBeInTheDocument();
      expect(screen.getByText('Đã nắm vững')).toBeInTheDocument();
      expect(chip).toHaveAttribute('aria-label', expect.stringContaining('Đã nắm vững'));
    });

    it('renders dashed border style for unseen status', () => {
      render(<ConceptChip status="unseen" term="obscure" />);
      const chip = screen.getByRole('status');
      expect(chip.className).toContain('border-dashed');
    });
  });

  describe('Progress', () => {
    it('renders valid progressbar with aria attributes', () => {
      render(<Progress value={65} max={100} label="Tiến độ học" showValueText />);
      const progressbar = screen.getByRole('progressbar');
      expect(progressbar).toHaveAttribute('aria-valuenow', '65');
      expect(progressbar).toHaveAttribute('aria-valuemin', '0');
      expect(progressbar).toHaveAttribute('aria-valuemax', '100');
      expect(screen.getByText('65%')).toBeInTheDocument();
    });
  });

  describe('EmptyState, ErrorState, InlineAlert, LoadingState', () => {
    it('renders EmptyState with title, description and triggers primary action', () => {
      const onAction = vi.fn();
      render(
        <EmptyState
          title="Không có từ nào đến hạn"
          description="Bạn đã hoàn thành bài hôm nay."
          actionLabel="Khám phá Reader"
          onAction={onAction}
        />
      );

      expect(screen.getByText('Không có từ nào đến hạn')).toBeInTheDocument();
      const actionBtn = screen.getByRole('button', { name: /Khám phá Reader/i });
      fireEvent.click(actionBtn);
      expect(onAction).toHaveBeenCalledTimes(1);
    });

    it('renders ErrorState and maps UNAUTHENTICATED error code', () => {
      const onRetry = vi.fn();
      render(<ErrorState code="UNAUTHENTICATED" onRetry={onRetry} />);

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Cần đăng nhập')).toBeInTheDocument();
      expect(screen.getByText(/Mã lỗi: UNAUTHENTICATED/i)).toBeInTheDocument();

      const retryBtn = screen.getByRole('button', { name: /Thử lại/i });
      fireEvent.click(retryBtn);
      expect(onRetry).toHaveBeenCalledTimes(1);
    });

    it('renders InlineAlert with alert role', () => {
      render(
        <InlineAlert variant="warning" title="Cần lưu ý">
          Từ vựng này cần được ôn tập sớm.
        </InlineAlert>
      );

      const alert = screen.getByRole('alert');
      expect(alert).toBeInTheDocument();
      expect(screen.getByText('Cần lưu ý')).toBeInTheDocument();
      expect(screen.getByText('Từ vựng này cần được ôn tập sớm.')).toBeInTheDocument();
    });

    it('renders LoadingState with polite status role', () => {
      render(<LoadingState message="Đang tải dữ liệu học..." />);
      const status = screen.getByRole('status');
      expect(status).toBeInTheDocument();
      expect(screen.getByText('Đang tải dữ liệu học...')).toBeInTheDocument();
    });
  });

  describe('Input / TextField', () => {
    it('renders label, placeholder, helperText and handles user input', () => {
      const handleChange = vi.fn();
      render(
        <Input
          label="Tìm kiếm từ vựng"
          placeholder="Nhập từ..."
          helperText="Hỗ trợ tra cứu nhanh"
          onChange={handleChange}
        />
      );

      expect(screen.getByLabelText('Tìm kiếm từ vựng')).toBeInTheDocument();
      expect(screen.getByPlaceholderText('Nhập từ...')).toBeInTheDocument();
      expect(screen.getByText('Hỗ trợ tra cứu nhanh')).toBeInTheDocument();

      const input = screen.getByLabelText('Tìm kiếm từ vựng');
      fireEvent.change(input, { target: { value: 'appointment' } });
      expect(handleChange).toHaveBeenCalled();
    });

    it('renders error message with aria-invalid and alert role', () => {
      render(
        <TextField
          label="Email"
          error="Email không hợp lệ"
          value="invalid-email"
        />
      );

      const input = screen.getByLabelText(/Email/i);
      expect(input).toHaveAttribute('aria-invalid', 'true');
      expect(screen.getByRole('alert')).toHaveTextContent('Email không hợp lệ');
    });

    it('renders clearable button and handles clear action', () => {
      const handleClear = vi.fn();
      const handleChange = vi.fn();
      render(
        <Input
          label="Từ khóa"
          value="appointment"
          clearable
          onClear={handleClear}
          onChange={handleChange}
        />
      );

      const clearBtn = screen.getByRole('button', { name: /Xóa nội dung nhập/i });
      expect(clearBtn).toBeInTheDocument();
      fireEvent.click(clearBtn);
      expect(handleClear).toHaveBeenCalledTimes(1);
    });
  });

  describe('Modal / Dialog', () => {
    it('renders when isOpen is true and hides when false', () => {
      const { rerender } = render(
        <Modal isOpen={false} onClose={vi.fn()}>
          <div>Nội dung modal</div>
        </Modal>
      );

      expect(screen.queryByRole('dialog')).not.toBeInTheDocument();

      rerender(
        <Modal isOpen={true} onClose={vi.fn()} title="Tiêu đề Modal">
          <div>Nội dung modal</div>
        </Modal>
      );

      const dialog = screen.getByRole('dialog');
      expect(dialog).toBeInTheDocument();
      expect(screen.getByText('Tiêu đề Modal')).toBeInTheDocument();
      expect(screen.getByText('Nội dung modal')).toBeInTheDocument();
    });

    it('triggers onClose when close button is clicked', () => {
      const handleClose = vi.fn();
      render(
        <Modal isOpen={true} onClose={handleClose} title="Hộp thoại">
          <div>Nội dung</div>
        </Modal>
      );

      const closeBtn = screen.getByRole('button', { name: /Đóng hộp thoại/i });
      fireEvent.click(closeBtn);
      expect(handleClose).toHaveBeenCalledTimes(1);
    });

    it('triggers onClose when Escape key is pressed', () => {
      const handleClose = vi.fn();
      render(
        <Dialog isOpen={true} onClose={handleClose} title="Hộp thoại">
          <div>Nội dung</div>
        </Dialog>
      );

      fireEvent.keyDown(document, { key: 'Escape' });
      expect(handleClose).toHaveBeenCalledTimes(1);
    });
  });

  describe('Tabs', () => {
    it('renders tabs and switches active panel on trigger click', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList ariaLabel="Danh mục">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Nội dung 1</TabsContent>
          <TabsContent value="tab2">Nội dung 2</TabsContent>
        </Tabs>
      );

      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });

      expect(tab1).toHaveAttribute('aria-selected', 'true');
      expect(tab2).toHaveAttribute('aria-selected', 'false');
      expect(screen.getByText('Nội dung 1')).toBeInTheDocument();
      expect(screen.queryByText('Nội dung 2')).not.toBeInTheDocument();

      fireEvent.click(tab2);
      expect(tab1).toHaveAttribute('aria-selected', 'false');
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Nội dung 2')).toBeInTheDocument();
    });

    it('supports keyboard Arrow navigation across tabs', () => {
      render(
        <Tabs defaultValue="tab1">
          <TabsList ariaLabel="Điều hướng phím">
            <TabsTrigger value="tab1">Tab 1</TabsTrigger>
            <TabsTrigger value="tab2">Tab 2</TabsTrigger>
          </TabsList>
          <TabsContent value="tab1">Nội dung 1</TabsContent>
          <TabsContent value="tab2">Nội dung 2</TabsContent>
        </Tabs>
      );

      const tablist = screen.getByRole('tablist');
      const tab1 = screen.getByRole('tab', { name: 'Tab 1' });
      tab1.focus();

      fireEvent.keyDown(tablist, { key: 'ArrowRight' });
      const tab2 = screen.getByRole('tab', { name: 'Tab 2' });
      expect(tab2).toHaveAttribute('aria-selected', 'true');
      expect(screen.getByText('Nội dung 2')).toBeInTheDocument();
    });
  });

  describe('Slider', () => {
    it('renders slider with label, unit, aria attributes and handles value change', () => {
      const handleChange = vi.fn();
      render(
        <Slider
          label="Thời lượng học"
          min={10}
          max={60}
          step={5}
          value={25}
          unit="phút"
          onChange={handleChange}
        />
      );

      expect(screen.getByText('Thời lượng học')).toBeInTheDocument();
      expect(screen.getByText('25 phút')).toBeInTheDocument();

      const slider = screen.getByRole('slider');
      expect(slider).toHaveAttribute('aria-valuenow', '25');
      expect(slider).toHaveAttribute('aria-valuemin', '10');
      expect(slider).toHaveAttribute('aria-valuemax', '60');

      fireEvent.change(slider, { target: { value: '30' } });
      expect(handleChange).toHaveBeenCalledWith(30);
    });

    it('handles keyboard ArrowRight / ArrowLeft stepping', () => {
      const handleChange = vi.fn();
      render(
        <Slider
          label="Ngân sách từ"
          min={2}
          max={10}
          step={1}
          value={4}
          onChange={handleChange}
        />
      );

      const slider = screen.getByRole('slider');
      fireEvent.keyDown(slider, { key: 'ArrowRight' });
      expect(handleChange).toHaveBeenCalledWith(5);
    });
  });

  describe('Tooltip', () => {
    it('renders child element and shows tooltip on mouse enter / focus', async () => {
      render(
        <Tooltip content="Giải thích chi tiết" delay={0}>
          <button>Hover me</button>
        </Tooltip>
      );

      const btn = screen.getByRole('button', { name: 'Hover me' });
      fireEvent.mouseEnter(btn);

      await waitFor(() => {
        expect(screen.getByRole('tooltip')).toBeInTheDocument();
        expect(screen.getByText('Giải thích chi tiết')).toBeInTheDocument();
      });

      fireEvent.mouseLeave(btn);
      await waitFor(() => {
        expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();
      });
    });
  });

  describe('Select', () => {
    it('renders combobox trigger and selects option from dropdown', () => {
      const handleChange = vi.fn();
      const options = [
        { value: 'A1', label: 'Cấp độ A1' },
        { value: 'A2', label: 'Cấp độ A2' },
        { value: 'B1', label: 'Cấp độ B1' },
      ];

      render(
        <Select
          label="Trình độ CEFR"
          options={options}
          value="A1"
          onChange={handleChange}
        />
      );

      const trigger = screen.getByRole('combobox');
      expect(trigger).toBeInTheDocument();
      expect(screen.getByText('Cấp độ A1')).toBeInTheDocument();

      // Open dropdown
      fireEvent.click(trigger);
      expect(trigger).toHaveAttribute('aria-expanded', 'true');

      const optionA2 = screen.getByRole('option', { name: /Cấp độ A2/i });
      fireEvent.click(optionA2);

      expect(handleChange).toHaveBeenCalledWith('A2');
      expect(trigger).toHaveAttribute('aria-expanded', 'false');
    });
  });

  describe('AudioPlayer', () => {
    it('renders audio playback button and handles click toggle', () => {
      const handlePlay = vi.fn();
      render(<AudioPlayer label="Phát âm từ vựng" onPlay={handlePlay} />);

      const btn = screen.getByRole('button', { name: 'Phát âm từ vựng' });
      expect(btn).toBeInTheDocument();
      fireEvent.click(btn);
      expect(handlePlay).toHaveBeenCalledTimes(1);
    });

    it('renders compact and sentence variants', () => {
      const { rerender } = render(
        <AudioPlayer variant="compact" label="appointment /əˈpɔɪnt.mənt/" />
      );
      expect(screen.getByText('appointment /əˈpɔɪnt.mənt/')).toBeInTheDocument();

      rerender(
        <AudioPlayer variant="sentence" label="Nghe toàn bộ câu" />
      );
      expect(screen.getByText('Nghe toàn bộ câu')).toBeInTheDocument();
    });
  });

  describe('WordCard', () => {
    it('renders word term, IPA, Vietnamese translation, examples, and ConceptChip', () => {
      render(
        <WordCard
          term="appointment"
          ipa="/əˈpɔɪnt.mənt/"
          pos="n"
          cefrLevel="A2"
          status="learning"
          translation_vi="Cuộc hẹn chính thức"
          definition="An arrangement to meet someone"
          examples={[
            {
              source: 'I made an appointment with Dr. Watson.',
              target: 'Tôi đã đặt một cuộc hẹn với bác sĩ Watson.',
            },
          ]}
        />
      );

      expect(screen.getByRole('heading', { level: 3, name: 'appointment' })).toBeInTheDocument();
      expect(screen.getByText('/əˈpɔɪnt.mənt/')).toBeInTheDocument();
      expect(screen.getByText('CEFR A2')).toBeInTheDocument();
      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();
      expect(screen.getByText('I made an appointment with Dr. Watson.')).toBeInTheDocument();
      expect(screen.getByText('Tôi đã đặt một cuộc hẹn với bác sĩ Watson.')).toBeInTheDocument();
      expect(screen.getByRole('status')).toBeInTheDocument();
    });

    it('renders compact variant for word lists', () => {
      render(
        <WordCard
          variant="compact"
          term="available"
          cefrLevel="A2"
          status="mastered"
          translation_vi="Có sẵn, rảnh rỗi"
        />
      );

      expect(screen.getByText('available')).toBeInTheDocument();
      expect(screen.getByText('Có sẵn, rảnh rỗi')).toBeInTheDocument();
      expect(screen.getByText('A2')).toBeInTheDocument();
    });
  });

  describe('ReviewCard', () => {
    it('renders self_recall mode, flips to reveal answer, and renders 4 FSRS rating buttons', () => {
      const handleRate = vi.fn();
      const { rerender } = render(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          ipa="/əˈpɔɪnt.mənt/"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          onRate={handleRate}
        />
      );

      expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
      expect(screen.getByText('/əˈpɔɪnt.mənt/')).toBeInTheDocument();

      const revealBtn = screen.getByRole('button', { name: /Hiện đáp án \(Reveal\)/i });
      expect(revealBtn).toBeInTheDocument();
      fireEvent.click(revealBtn);

      // Now revealed
      rerender(
        <ReviewCard
          mode="self_recall"
          term="appointment"
          ipa="/əˈpɔɪnt.mənt/"
          prompt="appointment"
          answer="Cuộc hẹn"
          translation_vi="Cuộc hẹn chính thức"
          isRevealed={true}
          onRate={handleRate}
        />
      );

      expect(screen.getByText('Cuộc hẹn chính thức')).toBeInTheDocument();

      // Check 4 FSRS rating buttons
      const againBtn = screen.getByRole('button', { name: /Quên \(Again\)/i });
      const hardBtn = screen.getByRole('button', { name: /Khó \(Hard\)/i });
      const goodBtn = screen.getByRole('button', { name: /Tốt \(Good\)/i });
      const easyBtn = screen.getByRole('button', { name: /Dễ \(Easy\)/i });

      expect(againBtn).toBeInTheDocument();
      expect(hardBtn).toBeInTheDocument();
      expect(goodBtn).toBeInTheDocument();
      expect(easyBtn).toBeInTheDocument();

      fireEvent.click(goodBtn);
      expect(handleRate).toHaveBeenCalledWith('good');
    });

    it('renders multiple choice mode and handles option selection', () => {
      const handleSubmit = vi.fn();
      render(
        <ReviewCard
          mode="multiple_choice"
          term="available"
          prompt="Chọn nghĩa đúng cho 'available':"
          answer="Có sẵn"
          options={['Có sẵn', 'Đắt đỏ', 'Vắng mặt', 'Trễ giờ']}
          onSubmitAnswer={handleSubmit}
        />
      );

      expect(screen.getByText("Chọn nghĩa đúng cho 'available':")).toBeInTheDocument();
      const optionBtn = screen.getByRole('button', { name: /Có sẵn/i });
      fireEvent.click(optionBtn);

      expect(handleSubmit).toHaveBeenCalledWith('Có sẵn');
      expect(screen.getByText(/Chính xác! Ghi nhớ tốt./i)).toBeInTheDocument();
    });
  });

  describe('ReaderSentence', () => {
    it('renders tokenized interactive words and target word chips', () => {
      const handleWordClick = vi.fn();
      render(
        <ReaderSentence
          text="I have an appointment tomorrow."
          tokens={[
            { raw: 'I', lemma: 'i' },
            { raw: 'have', lemma: 'have' },
            { raw: 'an', lemma: 'a' },
            { raw: 'appointment', lemma: 'appointment', status: 'learning' },
            { raw: 'tomorrow.', lemma: 'tomorrow' },
          ]}
          translation="Tôi có một cuộc hẹn vào ngày mai."
          targetWords={[{ term: 'appointment', status: 'learning' }]}
          onWordClick={handleWordClick}
        />
      );

      expect(screen.getAllByText('appointment').length).toBeGreaterThan(0);
      const appointmentTokenBtn = screen.getByRole('button', { name: 'appointment' });
      fireEvent.click(appointmentTokenBtn);
      expect(handleWordClick).toHaveBeenCalled();

      expect(screen.getByText('Từ vựng mục tiêu trong câu:')).toBeInTheDocument();
    });

    it('toggles Vietnamese translation visibility', () => {
      render(
        <ReaderSentence
          text="I have an appointment tomorrow."
          translation="Tôi có một cuộc hẹn vào ngày mai."
        />
      );

      expect(screen.queryByText('Tôi có một cuộc hẹn vào ngày mai.')).not.toBeInTheDocument();

      const toggleBtn = screen.getByRole('button', { name: /Hiện bản dịch tiếng Việt/i });
      fireEvent.click(toggleBtn);

      expect(screen.getByText('Tôi có một cuộc hẹn vào ngày mai.')).toBeInTheDocument();
    });
  });

  describe('ConceptNode', () => {
    it('renders graph node with label, CEFR badge and handles click', () => {
      const handleClick = vi.fn();
      render(
        <ConceptNode
          id="node-1"
          label="appointment"
          cefr="A2"
          status="learning"
          onClick={handleClick}
        />
      );

      const nodeBtn = screen.getByRole('button', { name: /appointment \(Đang học\)/i });
      expect(nodeBtn).toBeInTheDocument();
      expect(screen.getByText('A2')).toBeInTheDocument();

      fireEvent.click(nodeBtn);
      expect(handleClick).toHaveBeenCalledTimes(1);
    });
  });

  describe('BrainSummaryCard', () => {
    it('renders mastered, learning, weak counts, memory health, and level estimate', () => {
      render(
        <BrainSummaryCard
          masteredCount={483}
          learningCount={71}
          weakCount={28}
          retentionRate={87}
          memoryHealthScore={87}
          levelEstimate="A2 - B1"
          cefrBreakdown={{ A1: 210, A2: 153, B1: 71 }}
        />
      );

      expect(screen.getByText('Language Brain của bạn')).toBeInTheDocument();
      expect(screen.getByText('CEFR A2 - B1')).toBeInTheDocument();
      expect(screen.getByText('483')).toBeInTheDocument();
      expect(screen.getByText('71')).toBeInTheDocument();
      expect(screen.getByText('28')).toBeInTheDocument();
      expect(screen.getByText('87%')).toBeInTheDocument();
      expect(screen.getByText('210 từ')).toBeInTheDocument();
    });
  });

  describe('SkillMeter', () => {
    it('renders Recognition, Listening, Production progressbars with valid ARIA attributes', () => {
      render(
        <SkillMeter
          skills={{
            recognition: 72,
            listening: 54,
            production: 38,
          }}
        />
      );

      expect(screen.getByText('Bằng chứng năng lực theo chiều kỹ năng')).toBeInTheDocument();

      const progressbars = screen.getAllByRole('progressbar');
      expect(progressbars.length).toBe(3);

      expect(progressbars[0]).toHaveAttribute('aria-valuenow', '72');
      expect(progressbars[1]).toHaveAttribute('aria-valuenow', '54');
      expect(progressbars[2]).toHaveAttribute('aria-valuenow', '38');
    });
  });
});
