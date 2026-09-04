import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Select } from './Select';
import { BookOpen, RotateCcw, Brain, Headphones } from 'lucide-react';

const meta: Meta<typeof Select> = {
  title: 'Primitives/Select',
  component: Select,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Select>;

const cefrOptions = [
  { value: 'A0', label: 'A0 - Mới bắt đầu', description: 'Chưa có vốn từ vựng cơ bản' },
  { value: 'A1', label: 'A1 - Sơ cấp', description: 'Giao tiếp tình huống cực kỳ đơn giản' },
  { value: 'A2', label: 'A2 - Tiền trung cấp', description: 'Đọc hiểu đoạn văn ngắn và hội thoại quen thuộc' },
  { value: 'B1', label: 'B1 - Trung cấp', description: 'Tự tin tiếp nạp bài báo, podcast và diễn đạt ý kiến' },
];

export const Default: Story = {
  render: () => {
    const [level, setLevel] = useState('A2');
    return (
      <div className="w-80 p-4">
        <Select
          label="Mục tiêu trình độ CEFR"
          options={cefrOptions}
          value={level}
          onChange={setLevel}
          helperText="Lộ trình học và gợi ý bài đọc sẽ thích ứng theo cấp độ này."
          fullWidth
        />
      </div>
    );
  },
};

const activityOptions = [
  { value: 'read', label: 'Đọc & Tiếp nạp (Read)', icon: <BookOpen className="w-4 h-4 text-sky-600" /> },
  { value: 'review', label: 'Ôn tập ngắt quãng (Review)', icon: <RotateCcw className="w-4 h-4 text-amber-600" /> },
  { value: 'listen', label: 'Luyện phản xạ Nghe (Listen)', icon: <Headphones className="w-4 h-4 text-emerald-600" /> },
  { value: 'brain', label: 'Khám phá Language Brain', icon: <Brain className="w-4 h-4 text-indigo-600" /> },
];

export const WithIcons: Story = {
  render: () => {
    const [act, setAct] = useState('review');
    return (
      <div className="w-80 p-4">
        <Select
          label="Hoạt động ưu tiên trong Today"
          options={activityOptions}
          value={act}
          onChange={setAct}
          fullWidth
        />
      </div>
    );
  },
};

export const ErrorState: Story = {
  render: () => (
    <div className="w-80 p-4">
      <Select
        label="Giọng đọc phát âm ưu tiên"
        options={[
          { value: 'en-US', label: 'English (US) - Chuẩn Mỹ' },
          { value: 'en-GB', label: 'English (UK) - Chuẩn Anh' },
        ]}
        error="Vui lòng chọn một tùy chọn ngôn ngữ hợp lệ."
        fullWidth
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => {
    const [level, setLevel] = useState('B1');
    return (
      <div className="dark bg-slate-950 p-6 rounded-xl w-80 border border-slate-800 text-slate-100">
        <Select
          label="Cấp độ hiện tại (Dark Mode)"
          options={cefrOptions}
          value={level}
          onChange={setLevel}
          fullWidth
        />
      </div>
    );
  },
};
