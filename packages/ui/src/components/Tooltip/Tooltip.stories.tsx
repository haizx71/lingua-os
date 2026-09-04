import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tooltip } from './Tooltip';
import { Button } from '../Button/Button';
import { Info, Sparkles, Volume2, HelpCircle } from 'lucide-react';

const meta: Meta<typeof Tooltip> = {
  title: 'Primitives/Tooltip',
  component: Tooltip,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tooltip>;

export const Default: Story = {
  render: () => (
    <div className="p-12">
      <Tooltip content="Giải thích lý do: Ôn vì sắp chạm ngưỡng quên">
        <Button variant="outline" leftIcon={<Info className="w-4 h-4 text-indigo-600" />}>
          Di chuột vào đây
        </Button>
      </Tooltip>
    </div>
  ),
};

export const Positions: Story = {
  render: () => (
    <div className="flex gap-6 items-center p-16">
      <Tooltip content="Tooltip ở phía trên" position="top">
        <Button variant="secondary" size="sm">Top</Button>
      </Tooltip>
      <Tooltip content="Tooltip ở phía dưới" position="bottom">
        <Button variant="secondary" size="sm">Bottom</Button>
      </Tooltip>
      <Tooltip content="Tooltip ở bên trái" position="left">
        <Button variant="secondary" size="sm">Left</Button>
      </Tooltip>
      <Tooltip content="Tooltip ở bên phải" position="right">
        <Button variant="secondary" size="sm">Right</Button>
      </Tooltip>
    </div>
  ),
};

export const AudioPlaybackTooltip: Story = {
  render: () => (
    <div className="p-12">
      <Tooltip content="Nghe phát âm chuẩn bản xứ (IPA: /əˈpɔɪnt.mənt/)">
        <button
          type="button"
          aria-label="Phát âm từ"
          className="p-3 rounded-full bg-indigo-50 text-indigo-600 hover:bg-indigo-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-indigo-500"
        >
          <Volume2 className="w-5 h-5" />
        </button>
      </Tooltip>
    </div>
  ),
};

export const LightVariant: Story = {
  render: () => (
    <div className="p-12 bg-slate-100 rounded-xl">
      <Tooltip variant="light" content="Gợi ý: Nhấn phím cách (Space) để lật thẻ">
        <Button variant="primary">Chế độ sáng</Button>
      </Tooltip>
    </div>
  ),
};
