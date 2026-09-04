import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Input, TextField } from './Input';
import { Search, Mail, Lock, Sparkles } from 'lucide-react';

const meta: Meta<typeof Input> = {
  title: 'Primitives/Input',
  component: Input,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Input>;

export const Default: Story = {
  args: {
    label: 'Tìm kiếm từ vựng',
    placeholder: 'Nhập từ tiếng Anh hoặc tiếng Việt...',
    helperText: 'Hỗ trợ tra cứu theo từ gốc, dạng chia động từ và phiên âm IPA.',
    fullWidth: true,
  },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  ),
};

export const WithIcons: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input
        label="Tìm kiếm bài đọc"
        placeholder="Tìm kiếm..."
        leftIcon={<Search />}
        clearable
        defaultValue="appointment"
      />
      <Input
        label="Địa chỉ email"
        type="email"
        placeholder="learner@lingua-os.com"
        leftIcon={<Mail />}
      />
      <Input
        label="Mật khẩu"
        type="password"
        placeholder="••••••••"
        leftIcon={<Lock />}
      />
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-80">
      <Input inputSize="sm" label="Kích thước nhỏ (sm)" placeholder="Kích thước sm..." />
      <Input inputSize="md" label="Kích thước chuẩn (md - 44px)" placeholder="Kích thước md..." />
      <Input inputSize="lg" label="Kích thước lớn (lg - 48px)" placeholder="Kích thước lg..." />
    </div>
  ),
};

export const ErrorState: Story = {
  args: {
    label: 'Từ vựng mục tiêu',
    value: 'invalid#word',
    error: 'Từ vựng không hợp lệ. Vui lòng chỉ nhập các ký tự chữ cái.',
    leftIcon: <Sparkles />,
    fullWidth: true,
  },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  ),
};

export const Disabled: Story = {
  args: {
    label: 'Mã định danh concept',
    value: 'concept-cefr-b1-0924',
    disabled: true,
    helperText: 'Trường này do hệ thống sinh tự động và không thể chỉnh sửa.',
    fullWidth: true,
  },
  render: (args) => (
    <div className="w-80">
      <Input {...args} />
    </div>
  ),
};

export const ClearableInteractive: Story = {
  render: () => {
    const [val, setVal] = useState('Ước lượng trình độ khởi điểm A2-B1');
    return (
      <div className="w-80">
        <Input
          label="Mục tiêu học tập"
          value={val}
          onChange={(e) => setVal(e.target.value)}
          clearable
          onClear={() => setVal('')}
          helperText="Bấm nút X bên phải để xóa nhanh nội dung."
        />
      </div>
    );
  },
};

export const VietnameseStressTest: Story = {
  render: () => (
    <div className="flex flex-col gap-4 w-96">
      <Input
        label="Tiếng Việt có dấu: Trường đại học bách khoa & nghiên cứu ngôn ngữ"
        defaultValue="Học từ vựng qua ngữ cảnh thực tế với chu kỳ FSRS tối ưu"
        helperText="Kiểm tra không bị cắt dấu mũ, dấu móc (ả, ã, ạ, ắ, ằ, ẳ, ẵ, ặ, ấ, ầ, ổ, ỗ, ợ, ự)"
        leftIcon={<Search />}
        clearable
      />
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-96 border border-slate-800 text-slate-100">
      <Input
        label="Tìm kiếm trong Dark Mode"
        placeholder="Nhập từ vựng..."
        defaultValue="serendipity"
        helperText="Chế độ nền tối với độ tương phản WCAG 2.2 AA cao."
        leftIcon={<Search />}
        clearable
      />
    </div>
  ),
};
