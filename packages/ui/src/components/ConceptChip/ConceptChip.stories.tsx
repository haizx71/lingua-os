import type { Meta, StoryObj } from '@storybook/react';
import { ConceptChip } from './ConceptChip';
import type { ConceptStatus } from '../../tokens/semantic';

const meta: Meta<typeof ConceptChip> = {
  title: 'Components/ConceptChip',
  component: ConceptChip,
  tags: ['autodocs'],
  argTypes: {
    status: {
      control: 'select',
      options: [
        'unseen',
        'discovered',
        'learning',
        'familiar',
        'active',
        'mastered',
        'weak',
        'forgotten',
      ] as ConceptStatus[],
    },
    isDue: { control: 'boolean' },
    term: { control: 'text' },
    showStatusLabel: { control: 'boolean' },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg'],
    },
  },
};

export default meta;
type Story = StoryObj<typeof ConceptChip>;

export const Mastered: Story = {
  args: {
    status: 'mastered',
    term: 'appointment',
    showStatusLabel: true,
    size: 'md',
  },
};

export const Weak: Story = {
  args: {
    status: 'weak',
    term: 'schedule',
    showStatusLabel: true,
    size: 'md',
  },
};

export const Due: Story = {
  args: {
    status: 'learning',
    isDue: true,
    term: 'available',
    showStatusLabel: true,
    size: 'md',
  },
};

export const Learning: Story = {
  args: {
    status: 'learning',
    term: 'convenient',
    showStatusLabel: true,
    size: 'md',
  },
};

export const AllStatesMatrix: Story = {
  render: () => (
    <div className="flex flex-col gap-3 p-4">
      <h4 className="font-semibold text-sm text-slate-700">8 Trạng thái Concept trong Language Brain + Đến hạn ôn (isDue)</h4>
      <div className="flex flex-wrap gap-2">
        <ConceptChip status="unseen" term="unseen" />
        <ConceptChip status="discovered" term="discovered" />
        <ConceptChip status="learning" term="learning" />
        <ConceptChip status="familiar" term="familiar" />
        <ConceptChip status="active" term="active" />
        <ConceptChip status="mastered" term="mastered" />
        <ConceptChip status="weak" term="weak" />
        <ConceptChip status="forgotten" term="forgotten" />
        <ConceptChip status="learning" isDue term="due (đến hạn ôn)" />
      </div>
    </div>
  ),
};
