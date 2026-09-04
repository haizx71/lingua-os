import type { Meta, StoryObj } from '@storybook/react';
import { InlineAlert } from './InlineAlert';

const meta: Meta<typeof InlineAlert> = {
  title: 'Components/States/InlineAlert',
  component: InlineAlert,
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof InlineAlert>;

export const Info: Story = {
  args: {
    variant: 'info',
    title: 'Gợi ý học tập',
    children: 'Hôm nay bạn còn ngân sách học thêm 4 từ mới theo lịch trình.',
  },
};

export const Success: Story = {
  args: {
    variant: 'success',
    title: 'Đã cập nhật Language Brain',
    children: 'Từ "appointment" đã chuyển sang trạng thái "Đã nắm vững".',
  },
};

export const Warning: Story = {
  args: {
    variant: 'warning',
    title: 'Từ vựng cần củng cố',
    children: 'Kỹ năng nghe từ này đang yếu hơn nhận diện khi đọc.',
  },
};

export const Danger: Story = {
  args: {
    variant: 'danger',
    title: 'Không thể kết nối',
    children: 'Tiến độ ôn tập chưa được đồng bộ lên máy chủ.',
  },
};
