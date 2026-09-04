import React from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './Tabs';
import { Badge } from '../Badge/Badge';
import { BookOpen, RotateCcw, Brain, CheckCircle2, Clock } from 'lucide-react';

const meta: Meta<typeof Tabs> = {
  title: 'Primitives/Tabs',
  component: Tabs,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Tabs>;

export const DefaultLine: Story = {
  render: () => (
    <div className="w-[500px] p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
      <Tabs defaultValue="all" variant="line">
        <TabsList ariaLabel="Danh mục từ vựng">
          <TabsTrigger value="all">Tất cả (540)</TabsTrigger>
          <TabsTrigger value="due" badge={<Badge variant="warning" size="sm">23</Badge>}>
            Đến hạn ôn
          </TabsTrigger>
          <TabsTrigger value="learning">Đang học (71)</TabsTrigger>
          <TabsTrigger value="mastered">Đã nắm vững (483)</TabsTrigger>
        </TabsList>

        <TabsContent value="all">
          <p className="text-sm text-[var(--text-secondary,#475569)]">
            Hiển thị toàn bộ từ vựng đã phát hiện trong các bài đọc và bài học.
          </p>
        </TabsContent>
        <TabsContent value="due">
          <p className="text-sm text-[var(--text-secondary,#475569)]">
            23 từ vựng đang ở thời điểm vàng cần kích hoạt lại trí nhớ theo FSRS.
          </p>
        </TabsContent>
        <TabsContent value="learning">
          <p className="text-sm text-[var(--text-secondary,#475569)]">
            Các từ vựng đang trong chu kỳ lặp lại ngắt quãng ban đầu.
          </p>
        </TabsContent>
        <TabsContent value="mastered">
          <p className="text-sm text-[var(--text-secondary,#475569)]">
            Từ vựng có độ ổn định trí nhớ cao trên 21 ngày.
          </p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

export const PillVariantWithIcons: Story = {
  render: () => (
    <div className="w-[540px] p-4 bg-[var(--surface,#FFFFFF)] rounded-xl border border-[var(--border-subtle,#E2E8F0)]">
      <Tabs defaultValue="read" variant="pill">
        <TabsList ariaLabel="Hoạt động học tập">
          <TabsTrigger value="read" icon={<BookOpen className="w-4 h-4" />}>
            Đọc bài
          </TabsTrigger>
          <TabsTrigger value="review" icon={<RotateCcw className="w-4 h-4" />}>
            Ôn tập FSRS
          </TabsTrigger>
          <TabsTrigger value="brain" icon={<Brain className="w-4 h-4" />}>
            Language Brain
          </TabsTrigger>
        </TabsList>

        <TabsContent value="read">
          <div className="p-4 bg-[var(--surface-subtle,#F1F5F9)] rounded-lg">
            <h4 className="font-semibold text-sm text-[var(--text-primary,#0F172A)]">Kỹ năng Đọc & Tiếp nạp</h4>
            <p className="text-xs text-[var(--text-secondary,#475569)] mt-1">Đọc hiểu ngữ cảnh thực tế và trích xuất từ mới.</p>
          </div>
        </TabsContent>
        <TabsContent value="review">
          <div className="p-4 bg-[var(--surface-subtle,#F1F5F9)] rounded-lg">
            <h4 className="font-semibold text-sm text-[var(--text-primary,#0F172A)]">Smart Review</h4>
            <p className="text-xs text-[var(--text-secondary,#475569)] mt-1">Tối ưu hóa khả năng ghi nhớ dài hạn với 4 mức đánh giá.</p>
          </div>
        </TabsContent>
        <TabsContent value="brain">
          <div className="p-4 bg-[var(--surface-subtle,#F1F5F9)] rounded-lg">
            <h4 className="font-semibold text-sm text-[var(--text-primary,#0F172A)]">Bản đồ Language Brain</h4>
            <p className="text-xs text-[var(--text-secondary,#475569)] mt-1">Mô hình hóa toàn bộ vốn từ và bằng chứng năng lực.</p>
          </div>
        </TabsContent>
      </Tabs>
    </div>
  ),
};

export const Sizes: Story = {
  render: () => (
    <div className="flex flex-col gap-6 w-[500px]">
      <Tabs defaultValue="1" size="sm" variant="pill">
        <TabsList>
          <TabsTrigger value="1">Kích thước Nhỏ (sm)</TabsTrigger>
          <TabsTrigger value="2">Tùy chọn 2</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs defaultValue="1" size="md" variant="pill">
        <TabsList>
          <TabsTrigger value="1">Kích thước Vừa (md)</TabsTrigger>
          <TabsTrigger value="2">Tùy chọn 2</TabsTrigger>
        </TabsList>
      </Tabs>

      <Tabs defaultValue="1" size="lg" variant="pill">
        <TabsList>
          <TabsTrigger value="1">Kích thước Lớn (lg)</TabsTrigger>
          <TabsTrigger value="2">Tùy chọn 2</TabsTrigger>
        </TabsList>
      </Tabs>
    </div>
  ),
};

export const DarkTheme: Story = {
  render: () => (
    <div className="dark bg-slate-950 p-6 rounded-xl w-[500px] border border-slate-800 text-slate-100">
      <Tabs defaultValue="today" variant="line">
        <TabsList ariaLabel="Điều hướng Dark Mode">
          <TabsTrigger value="today">Hôm nay</TabsTrigger>
          <TabsTrigger value="plan">Lộ trình</TabsTrigger>
          <TabsTrigger value="history">Lịch sử</TabsTrigger>
        </TabsList>
        <TabsContent value="today">
          <p className="text-sm text-slate-400 pt-2">Giao diện tương phản cao trong chế độ ban đêm.</p>
        </TabsContent>
      </Tabs>
    </div>
  ),
};
