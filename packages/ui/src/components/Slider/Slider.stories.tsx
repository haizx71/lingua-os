import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Slider } from './Slider';

const meta: Meta<typeof Slider> = {
  title: 'Primitives/Slider',
  component: Slider,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Slider>;

export const StudyDuration: Story = {
  render: () => {
    const [val, setVal] = useState(25);
    return (
      <div className="w-80 p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
        <Slider
          label="Thời lượng học mỗi ngày"
          min={10}
          max={60}
          step={5}
          value={val}
          onChange={setVal}
          unit="phút"
          helperText="Thuật toán Today Engine sẽ phân bổ khối lượng bài đọc và ôn tập phù hợp."
          marks={[
            { value: 10, label: '10p' },
            { value: 25, label: '25p' },
            { value: 45, label: '45p' },
            { value: 60, label: '60p' },
          ]}
        />
      </div>
    );
  },
};

export const WordBudget: Story = {
  render: () => {
    const [val, setVal] = useState(4);
    return (
      <div className="w-80 p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
        <Slider
          label="Ngân sách từ mới hàng ngày"
          min={2}
          max={15}
          step={1}
          value={val}
          onChange={setVal}
          unit="từ/ngày"
          helperText="Giới hạn số lượng concept mới để đảm bảo độ bền trí nhớ lâu dài."
          marks={[
            { value: 2, label: '2 từ' },
            { value: 5, label: '5 từ' },
            { value: 10, label: '10 từ' },
            { value: 15, label: '15 từ' },
          ]}
        />
      </div>
    );
  },
};

export const Disabled: Story = {
  render: () => (
    <div className="w-80 p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
      <Slider
        label="Cài đặt bị khóa trong buổi thi"
        min={0}
        max={100}
        value={50}
        unit="%"
        disabled
        helperText="Không thể thay đổi thiết lập trong phiên kiểm tra năng lực."
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => {
    const [val, setVal] = useState(30);
    return (
      <div className="dark bg-slate-950 p-6 rounded-xl w-80 border border-slate-800 text-slate-100">
        <Slider
          label="Thời gian phiên học ban đêm"
          min={10}
          max={60}
          step={5}
          value={val}
          onChange={setVal}
          unit="phút"
          helperText="Chế độ Dark Mode với độ tương phản đạt chuẩn WCAG 2.2 AA."
          marks={[
            { value: 10, label: '10p' },
            { value: 30, label: '30p' },
            { value: 60, label: '60p' },
          ]}
        />
      </div>
    );
  },
};
