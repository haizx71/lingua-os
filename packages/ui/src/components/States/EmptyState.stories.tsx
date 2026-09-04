import type { Meta, StoryObj } from '@storybook/react';
import { EmptyState } from './EmptyState';
import { BookOpen, CheckCircle, Search } from 'lucide-react';

const meta: Meta<typeof EmptyState> = {
  title: 'Components/States/EmptyState',
  component: EmptyState,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof EmptyState>;

export const NoReviewsDue: Story = {
  args: {
    title: 'Không có từ nào đến hạn ôn',
    description: 'Tuyệt vời! Bạn đã hoàn thành toàn bộ hàng đợi FSRS hôm nay.',
    icon: <CheckCircle className="w-8 h-8 text-emerald-600" />,
    actionLabel: 'Đọc bài mới trong Reader',
    onAction: () => alert('Đi tới Reader'),
  },
};

export const EmptySearch: Story = {
  args: {
    title: 'Không tìm thấy từ vựng',
    description: 'Không có kết quả nào khớp với từ khóa tìm kiếm trong từ điển.',
    icon: <Search className="w-8 h-8 text-slate-500" />,
    actionLabel: 'Xóa bộ lọc tìm kiếm',
    onAction: () => alert('Clear search'),
  },
};

export const FirstTimeReader: Story = {
  args: {
    title: 'Chưa có bài đọc nào được lưu',
    description: 'Hãy khám phá thư viện truyện ngắn và bài báo phù hợp trình độ của bạn.',
    icon: <BookOpen className="w-8 h-8 text-indigo-600" />,
    actionLabel: 'Khám phá thư viện bài đọc',
    onAction: () => alert('Đi tới thư viện'),
  },
};
