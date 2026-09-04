import type { Meta, StoryObj } from '@storybook/react';
import { Skeleton } from './Skeleton';

const meta: Meta<typeof Skeleton> = {
  title: 'Components/States/Skeleton',
  component: Skeleton,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Skeleton>;

export const Text: Story = {
  args: {
    variant: 'text',
    className: 'w-3/4',
  },
};

export const CardSkeleton: Story = {
  render: () => (
    <div className="p-6 border rounded-2xl bg-white space-y-4 max-w-sm">
      <div className="flex items-center gap-3">
        <Skeleton variant="circular" className="w-10 h-10" />
        <div className="space-y-1.5 flex-1">
          <Skeleton variant="text" className="w-1/2 h-4" />
          <Skeleton variant="text" className="w-1/3 h-3" />
        </div>
      </div>
      <Skeleton variant="rectangular" className="h-20 w-full" />
      <div className="flex gap-2">
        <Skeleton variant="rectangular" className="h-9 w-24" />
        <Skeleton variant="rectangular" className="h-9 w-24" />
      </div>
    </div>
  ),
};
