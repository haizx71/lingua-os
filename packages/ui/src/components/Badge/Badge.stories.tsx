import type { Meta, StoryObj } from '@storybook/react';
import { Badge } from './Badge';
import { Award, AlertTriangle, Clock } from 'lucide-react';

const meta: Meta<typeof Badge> = {
  title: 'Components/Badge',
  component: Badge,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Badge>;

export const Neutral: Story = {
  args: {
    variant: 'neutral',
    children: 'A2 Elementary',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    icon: <Award className="w-3.5 h-3.5" />,
    children: 'Đã nắm vững 483 từ',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    icon: <AlertTriangle className="w-3.5 h-3.5" />,
    children: '28 từ cần củng cố',
  },
};

export const Info: Story = {
  args: {
    variant: 'info',
    icon: <Clock className="w-3.5 h-3.5" />,
    children: '23 mục đến hạn ôn',
  },
};
