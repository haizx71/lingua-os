import type { Meta, StoryObj } from '@storybook/react';
import { Progress } from './Progress';

const meta: Meta<typeof Progress> = {
  title: 'Components/Progress',
  component: Progress,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Progress>;

export const Default: Story = {
  args: {
    value: 65,
    max: 100,
    label: 'Kế hoạch học Today',
    showValueText: true,
    size: 'md',
    variant: 'primary',
  },
};

export const Success: Story = {
  args: {
    value: 87,
    max: 100,
    label: 'Sức khỏe trí nhớ (Memory Health)',
    showValueText: true,
    size: 'md',
    variant: 'success',
  },
};

export const Warning: Story = {
  args: {
    value: 38,
    max: 100,
    label: 'Năng lực tự sử dụng (Production Evidence)',
    showValueText: true,
    size: 'md',
    variant: 'warning',
  },
};
