import type { Meta, StoryObj } from '@storybook/react';
import { Card } from './Card';

const meta: Meta<typeof Card> = {
  title: 'Components/Card',
  component: Card,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Card>;

export const Default: Story = {
  args: {
    padding: 'md',
    variant: 'default',
    children: (
      <div>
        <h4 className="font-semibold text-base mb-1">Mục tiêu hôm nay</h4>
        <p className="text-sm text-slate-600">Hoàn thành 25 phút học thích nghi</p>
      </div>
    ),
  },
};

export const Subtle: Story = {
  args: {
    padding: 'md',
    variant: 'subtle',
    children: (
      <div>
        <span className="text-xs font-semibold text-slate-500 uppercase">Lý do chọn</span>
        <p className="text-sm font-medium mt-1">Ôn tập vì có 23 từ đến hạn theo FSRS</p>
      </div>
    ),
  },
};

export const Interactive: Story = {
  args: {
    padding: 'md',
    variant: 'interactive',
    children: (
      <div>
        <h4 className="font-semibold text-base mb-1">Bài đọc: The Morning Routine</h4>
        <p className="text-sm text-slate-600">Độ phù hợp 96% • 5 phút đọc</p>
      </div>
    ),
  },
};
