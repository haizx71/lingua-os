import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { ConceptNode } from './ConceptNode';

const meta: Meta<typeof ConceptNode> = {
  title: 'Domain/ConceptNode',
  component: ConceptNode,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ConceptNode>;

export const StatusMatrix: Story = {
  render: () => (
    <div className="grid grid-cols-3 gap-3 p-6 max-w-lg bg-[var(--surface-subtle)] rounded-2xl">
      <ConceptNode id="1" label="serendipity" cefr="B2" status="unseen" />
      <ConceptNode id="2" label="discover" cefr="A2" status="discovered" />
      <ConceptNode id="3" label="appointment" cefr="A2" status="learning" />
      <ConceptNode id="4" label="familiar" cefr="B1" status="familiar" />
      <ConceptNode id="5" label="fluency" cefr="B1" status="active" />
      <ConceptNode id="6" label="available" cefr="A2" status="mastered" />
      <ConceptNode id="7" label="schedule" cefr="A2" status="weak" />
      <ConceptNode id="8" label="obscure" cefr="B2" status="forgotten" />
      <ConceptNode id="9" label="priority" cefr="B1" status="learning" isDue={true} />
    </div>
  ),
};

export const SelectedAndFaded: Story = {
  render: () => (
    <div className="flex gap-4 items-center p-6">
      <ConceptNode id="10" label="selected node" cefr="A2" status="learning" isSelected={true} />
      <ConceptNode id="11" label="faded node" cefr="B1" status="mastered" isFaded={true} />
    </div>
  ),
};

export const MotionReduced: Story = {
  parameters: {
    docs: {
      description: {
        story: 'Verifies static rendering without scaling animations under prefers-reduced-motion.',
      },
    },
  },
  render: () => (
    <div className="flex gap-3 p-6">
      <ConceptNode id="15" label="accessible node" cefr="B2" status="mastered" isSelected={true} />
      <ConceptNode id="16" label="due review" cefr="A2" status="learning" isDue={true} />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-2xl border border-slate-800 text-slate-100 flex gap-3">
      <ConceptNode id="12" label="appointment" cefr="A2" status="learning" isDue={true} />
      <ConceptNode id="13" label="mastered word" cefr="B1" status="mastered" />
      <ConceptNode id="14" label="weak word" cefr="A2" status="weak" />
    </div>
  ),
};

