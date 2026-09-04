import type { Meta, StoryObj } from '@storybook/react';
import { ErrorState } from './ErrorState';

const meta: Meta<typeof ErrorState> = {
  title: 'Components/States/ErrorState',
  component: ErrorState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof ErrorState>;

export const Default: Story = {
  args: {
    title: 'Không thể tải dữ liệu Today',
    message: 'Kết nối mạng không ổn định hoặc máy chủ đang bận. Vui lòng thử lại.',
    onRetry: () => alert('Retrying...'),
    retryLabel: 'Thử lại ngay',
  },
};

export const WithErrorCode: Story = {
  args: {
    code: 'UNAUTHENTICATED',
    onRetry: () => alert('Redirecting to login...'),
    retryLabel: 'Đăng nhập lại',
  },
};

export const NotFound: Story = {
  args: {
    code: 'NOT_FOUND',
    onRetry: () => alert('Back to home...'),
    retryLabel: 'Quay lại Today',
  },
};
