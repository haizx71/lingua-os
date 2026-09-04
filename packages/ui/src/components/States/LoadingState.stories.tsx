import type { Meta, StoryObj } from '@storybook/react';
import { LoadingState } from './LoadingState';

const meta: Meta<typeof LoadingState> = {
  title: 'Components/States/LoadingState',
  component: LoadingState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof LoadingState>;

export const Default: Story = {
  args: {
    message: 'Đang tải kế hoạch học Today...',
    size: 'md',
  },
};

export const Small: Story = {
  args: {
    message: 'Đang lưu đánh giá...',
    size: 'sm',
  },
};
