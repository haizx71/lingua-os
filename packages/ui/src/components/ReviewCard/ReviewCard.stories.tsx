import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ReviewCard } from './ReviewCard';

const meta: Meta<typeof ReviewCard> = {
  title: 'Domain/ReviewCard',
  component: ReviewCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ReviewCard>;

export const SelfRecallMode: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="self_recall"
        term="appointment"
        ipa="/əˈpɔɪnt.mənt/"
        pos="n"
        prompt="appointment"
        answer="Cuộc hẹn, sự thu xếp gặp gỡ"
        translation_vi="Cuộc hẹn chính thức tại một thời điểm xác định."
        definition="An arrangement to meet someone at a particular time and place."
        contextSentence="I would like to make an appointment with Dr. Watson."
        contextTranslation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson."
        status="learning"
        isDue={true}
        sessionProgress={{ current: 3, total: 23 }}
      />
    </div>
  ),
};

export const SelfRecallRevealed: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="self_recall"
        term="appointment"
        ipa="/əˈpɔɪnt.mənt/"
        pos="n"
        prompt="appointment"
        answer="Cuộc hẹn, sự thu xếp gặp gỡ"
        translation_vi="Cuộc hẹn chính thức tại một thời điểm xác định."
        definition="An arrangement to meet someone at a particular time and place."
        contextSentence="I would like to make an appointment with Dr. Watson."
        contextTranslation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson."
        status="learning"
        isDue={true}
        isRevealed={true}
        sessionProgress={{ current: 3, total: 23 }}
      />
    </div>
  ),
};

export const MultipleChoiceMode: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="multiple_choice"
        term="available"
        ipa="/əˈveɪ.lə.bəl/"
        prompt="Chọn nghĩa đúng nhất cho từ 'available':"
        answer="Có sẵn, rảnh rỗi để gặp"
        options={[
          'Có sẵn, rảnh rỗi để gặp',
          'Tránh né, không xuất hiện',
          'Đắt đỏ, vượt ngân sách',
          'Đến muộn, trễ giờ hẹn',
        ]}
        translation_vi="Có sẵn để dùng hoặc rảnh rỗi để gặp gỡ."
        status="learning"
        sessionProgress={{ current: 4, total: 23 }}
      />
    </div>
  ),
};

export const TypingMode: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="typing"
        term="schedule"
        prompt="Từ tiếng Anh có nghĩa 'Lịch trình / Sắp xếp thời gian' (/ˈskedʒ.uːl/):"
        answer="schedule"
        translation_vi="Lịch trình, kế hoạch làm việc theo giờ."
        status="weak"
        sessionProgress={{ current: 5, total: 23 }}
      />
    </div>
  ),
};

export const ClozeMode: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="cloze"
        term="appointment"
        prompt="I would like to make an [...] with Dr. Watson for tomorrow morning."
        contextTranslation="Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai."
        answer="appointment"
        translation_vi="Cuộc hẹn"
        status="learning"
        isDue={true}
        sessionProgress={{ current: 6, total: 23 }}
      />
    </div>
  ),
};

export const ListeningMode: Story = {
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="listening"
        term="recommend"
        prompt="recommend"
        answer="recommend"
        translation_vi="Khuyên bảo, giới thiệu"
        definition="To suggest that someone or something would be good or suitable for a particular purpose."
        status="learning"
        sessionProgress={{ current: 7, total: 23 }}
      />
    </div>
  ),
};

export const MotionReducedMode: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Demonstrates instant zero-duration state transitions when prefers-reduced-motion is active.',
      },
    },
  },
  render: () => (
    <div className="w-[520px] p-4">
      <ReviewCard
        mode="self_recall"
        term="persistence"
        ipa="/pɚˈsɪs.təns/"
        pos="n"
        prompt="persistence"
        answer="Sự kiên trì, bền bỉ"
        translation_vi="Hành động kiên trì tiếp tục làm điều gì đó bất chấp khó khăn."
        definition="Firm or obstinate continuance in a course of action in spite of difficulty or opposition."
        status="active"
        isRevealed={true}
        sessionProgress={{ current: 15, total: 20 }}
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-[520px] border border-slate-800 text-slate-100">
      <ReviewCard
        mode="self_recall"
        term="serendipity"
        ipa="/ˌser.ənˈdɪp.ə.ti/"
        pos="noun"
        prompt="serendipity"
        answer="Sự may mắn tình cờ"
        translation_vi="Khả năng tìm thấy những điều thú vị hoặc giá trị một cách tình cờ."
        status="learning"
        isRevealed={true}
        sessionProgress={{ current: 12, total: 20 }}
      />
    </div>
  ),
};

