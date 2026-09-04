import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { BrainSummaryCard } from './BrainSummaryCard';

const meta: Meta<typeof BrainSummaryCard> = {
  title: 'Domain/BrainSummaryCard',
  component: BrainSummaryCard,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof BrainSummaryCard>;

export const Default: Story = {
  render: () => (
    <div className="w-[600px] p-4">
      <BrainSummaryCard
        masteredCount={483}
        learningCount={71}
        weakCount={28}
        retentionRate={87}
        memoryHealthScore={87}
        levelEstimate="A2 - B1"
        confidence="high"
        cefrBreakdown={{
          A0: 120,
          A1: 210,
          A2: 153,
          B1: 71,
        }}
        onExploreClick={() => alert('Khám phá đồ thị Language Brain')}
      />
    </div>
  ),
};

export const InitialPlacementState: Story = {
  render: () => (
    <div className="w-[600px] p-4">
      <BrainSummaryCard
        masteredCount={45}
        learningCount={18}
        weakCount={6}
        retentionRate={72}
        memoryHealthScore={72}
        levelEstimate="A1"
        confidence="low"
        cefrBreakdown={{
          A0: 30,
          A1: 15,
        }}
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-2xl w-[600px] border border-slate-800 text-slate-100">
      <BrainSummaryCard
        masteredCount={483}
        learningCount={71}
        weakCount={28}
        retentionRate={87}
        memoryHealthScore={87}
        levelEstimate="B1"
        confidence="high"
        cefrBreakdown={{
          A0: 120,
          A1: 210,
          A2: 153,
          B1: 71,
        }}
      />
    </div>
  ),
};
