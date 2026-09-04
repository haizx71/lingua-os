import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { AudioPlayer } from './AudioPlayer';

const meta: Meta<typeof AudioPlayer> = {
  title: 'Primitives/AudioPlayer',
  component: AudioPlayer,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof AudioPlayer>;

export const DefaultButton: Story = {
  render: () => (
    <div className="flex gap-4 items-center p-4">
      <AudioPlayer size="sm" label="Phát âm (sm)" />
      <AudioPlayer size="md" label="Phát âm (md)" />
      <AudioPlayer size="lg" label="Phát âm (lg)" />
    </div>
  ),
};

export const CompactBar: Story = {
  render: () => (
    <div className="p-4">
      <AudioPlayer variant="compact" label="appointment /əˈpɔɪnt.mənt/" />
    </div>
  ),
};

export const SentenceBar: Story = {
  render: () => (
    <div className="w-96 p-4">
      <AudioPlayer
        variant="sentence"
        label="Making an Appointment • Câu 1/6"
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-96 border border-slate-800 text-slate-100 flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <AudioPlayer size="md" label="Phát âm từ vựng" />
        <span className="text-sm font-medium">appointment /əˈpɔɪnt.mənt/</span>
      </div>
      <AudioPlayer variant="sentence" label="Nghe toàn bộ câu trong bài đọc" />
    </div>
  ),
};
