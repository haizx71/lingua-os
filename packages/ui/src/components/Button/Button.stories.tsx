import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './Button';
import { ArrowRight, BookOpen } from 'lucide-react';

const meta: Meta<typeof Button> = {
  title: 'Components/Button',
  component: Button,
  tags: ['autodocs'],
  argTypes: {
    variant: {
      control: 'select',
      options: ['primary', 'secondary', 'outline', 'ghost', 'danger'],
    },
    size: {
      control: 'select',
      options: ['sm', 'md', 'lg', 'icon'],
    },
    isLoading: { control: 'boolean' },
    disabled: { control: 'boolean' },
  },
};

export default meta;
type Story = StoryObj<typeof Button>;

export const Primary: Story = {
  args: {
    children: 'Bắt đầu học Today',
    variant: 'primary',
    size: 'md',
  },
};

export const Secondary: Story = {
  args: {
    children: 'Xem chi tiết',
    variant: 'secondary',
    size: 'md',
  },
};

export const Outline: Story = {
  args: {
    children: 'Bỏ qua câu này',
    variant: 'outline',
    size: 'md',
  },
};

export const Ghost: Story = {
  args: {
    children: 'Đóng',
    variant: 'ghost',
    size: 'md',
  },
};

export const Danger: Story = {
  args: {
    children: 'Xóa tài khoản',
    variant: 'danger',
    size: 'md',
  },
};

export const WithIcons: Story = {
  args: {
    children: 'Bắt đầu đọc',
    variant: 'primary',
    leftIcon: <BookOpen className="w-4 h-4" />,
    rightIcon: <ArrowRight className="w-4 h-4" />,
  },
};

export const Loading: Story = {
  args: {
    children: 'Đang lưu kết quả...',
    variant: 'primary',
    isLoading: true,
  },
};

export const Disabled: Story = {
  args: {
    children: 'Đã hoàn thành',
    variant: 'primary',
    disabled: true,
  },
};
