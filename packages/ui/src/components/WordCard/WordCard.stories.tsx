import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { WordCard } from './WordCard';
import { Button } from '../Button/Button';
import { Bookmark, ExternalLink } from 'lucide-react';

const meta: Meta<typeof WordCard> = {
  title: 'Domain/WordCard',
  component: WordCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof WordCard>;

export const Default: Story = {
  render: () => (
    <div className="w-[480px] p-4">
      <WordCard
        term="appointment"
        ipa="/əˈpɔɪnt.mənt/"
        pos="noun"
        cefrLevel="A2"
        status="learning"
        translation_vi="Cuộc hẹn, sự thu xếp gặp gỡ tại thời điểm ấn định."
        definition="An arrangement to meet someone at a particular time and place."
        examples={[
          {
            source: 'I would like to make an appointment with Dr. Watson for tomorrow morning.',
            target: 'Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai.',
          },
          {
            source: 'She has a dentist appointment at 3 PM.',
            target: 'Cô ấy có một cuộc hẹn với nha sĩ lúc 3 giờ chiều.',
          },
        ]}
        actionSlot={
          <>
            <Button variant="ghost" size="sm" leftIcon={<Bookmark className="w-4 h-4" />}>
              Lưu vào Thư viện
            </Button>
            <Button variant="outline" size="sm" rightIcon={<ExternalLink className="w-3.5 h-3.5" />}>
              Xem trong Từ điển
            </Button>
          </>
        }
      />
    </div>
  ),
};

export const CompactList: Story = {
  render: () => (
    <div className="w-96 space-y-2.5 p-4">
      <WordCard
        variant="compact"
        term="appointment"
        cefrLevel="A2"
        status="learning"
        translation_vi="Cuộc hẹn, sự thu xếp gặp gỡ"
      />
      <WordCard
        variant="compact"
        term="available"
        cefrLevel="A2"
        status="mastered"
        translation_vi="Có sẵn, rảnh rỗi"
      />
      <WordCard
        variant="compact"
        term="recommend"
        cefrLevel="B1"
        status="weak"
        translation_vi="Khuyên bảo, giới thiệu"
      />
      <WordCard
        variant="compact"
        term="serendipity"
        cefrLevel="B2"
        status="unseen"
        translation_vi="Sự may mắn tình cờ"
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-[480px] border border-slate-800 text-slate-100">
      <WordCard
        term="fluency"
        ipa="/ˈfluː.ən.si/"
        pos="noun"
        cefrLevel="B1"
        status="mastered"
        translation_vi="Sự lưu loát, trôi chảy trong ngôn ngữ."
        definition="The ability to speak or write a language easily, well, and quickly."
        examples={[
          {
            source: 'Daily immersion reading accelerates vocabulary fluency.',
            target: 'Đọc tiếp nạp hàng ngày thúc đẩy sự lưu loát từ vựng.',
          },
        ]}
      />
    </div>
  ),
};
