import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { SkillMeter } from './SkillMeter';

const meta: Meta<typeof SkillMeter> = {
  title: 'Domain/SkillMeter',
  component: SkillMeter,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof SkillMeter>;

export const TriDimensionalOverview: Story = {
  render: () => (
    <div className="w-[500px] p-4">
      <SkillMeter
        skills={{
          recognition: 72,
          listening: 54,
          production: 38,
        }}
      />
    </div>
  ),
};

export const SingleSkillView: Story = {
  render: () => (
    <div className="w-[400px] p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
      <SkillMeter
        singleSkill={{
          type: 'listening',
          label: 'Nghe hiểu từ vựng',
          score: 68,
          description: 'Bạn đã hoàn thành 42 bài tập nhận diện âm thanh tuần này.',
        }}
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-[500px] border border-slate-800 text-slate-100">
      <SkillMeter
        skills={{
          recognition: 85,
          listening: 60,
          production: 45,
        }}
      />
    </div>
  ),
};
