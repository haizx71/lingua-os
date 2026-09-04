import React, { useState } from 'react';
import type { Meta, StoryObj } from '@storybook/react';
import { Modal } from './Modal';
import { Button } from '../Button/Button';
import { ConceptChip } from '../ConceptChip/ConceptChip';
import { Volume2, Bookmark, CheckCircle2 } from 'lucide-react';

const meta: Meta<typeof Modal> = {
  title: 'Primitives/Modal',
  component: Modal,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
};

export default meta;
type Story = StoryObj<typeof Modal>;

export const Default: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="p-4">
        <Button onClick={() => setIsOpen(true)}>Mở hộp thoại</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title="Xác nhận hoàn thành bài đọc"
          description="Hệ thống sẽ cập nhật 4 concept mới vào Language Brain của bạn."
          footer={
            <>
              <Button variant="secondary" onClick={() => setIsOpen(false)}>
                Hủy bỏ
              </Button>
              <Button variant="primary" onClick={() => setIsOpen(false)}>
                Xác nhận lưu
              </Button>
            </>
          }
        >
          <div className="space-y-3">
            <p>
              Bạn vừa hoàn thành bài đọc <strong>Making an Appointment</strong> với 180 từ vựng và 96% độ quen thuộc.
            </p>
            <div className="flex gap-2 pt-2">
              <ConceptChip status="mastered" term="appointment" />
              <ConceptChip status="learning" term="available" />
            </div>
          </div>
        </Modal>
      </div>
    );
  },
};

export const WordInspectorModal: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="p-4">
        <Button onClick={() => setIsOpen(true)}>Xem chi tiết từ vựng</Button>
        <Modal
          isOpen={isOpen}
          onClose={() => setIsOpen(false)}
          title={
            <div className="flex items-center gap-3">
              <span>appointment</span>
              <ConceptChip status="learning" size="sm" />
            </div>
          }
          description="/əˈpɔɪnt.mənt/ • danh từ"
          size="md"
          footer={
            <>
              <Button variant="outline" size="sm" leftIcon={<Bookmark className="w-4 h-4" />}>
                Lưu vào thư viện
              </Button>
              <Button variant="primary" size="sm" onClick={() => setIsOpen(false)}>
                Đã hiểu
              </Button>
            </>
          }
        >
          <div className="space-y-4">
            <div>
              <h4 className="text-xs font-bold uppercase tracking-wider text-indigo-600 mb-1">
                Định nghĩa tiếng Việt
              </h4>
              <p className="text-base text-[var(--text-primary,#0F172A)] font-medium">
                Cuộc hẹn chính thức, sự thu xếp gặp gỡ tại một thời điểm cụ thể.
              </p>
            </div>

            <div className="bg-[var(--surface-subtle,#F1F5F9)] p-3 rounded-lg border border-[var(--border-subtle,#E2E8F0)]">
              <h4 className="text-xs font-semibold text-[var(--text-secondary,#475569)] mb-1">
                Ví dụ ngữ cảnh:
              </h4>
              <p className="text-sm italic text-[var(--text-primary,#0F172A)]">
                &ldquo;I would like to make an <strong>appointment</strong> with Dr. Watson for tomorrow morning.&rdquo;
              </p>
              <p className="text-xs text-[var(--text-secondary,#475569)] mt-1">
                Tôi muốn đặt một cuộc hẹn với bác sĩ Watson vào sáng mai.
              </p>
            </div>
          </div>
        </Modal>
      </div>
    );
  },
};

export const Sizes: Story = {
  render: () => {
    const [size, setSize] = useState<'sm' | 'md' | 'lg' | null>(null);

    return (
      <div className="flex gap-3 p-4">
        <Button variant="outline" onClick={() => setSize('sm')}>Kích thước SM</Button>
        <Button variant="outline" onClick={() => setSize('md')}>Kích thước MD</Button>
        <Button variant="outline" onClick={() => setSize('lg')}>Kích thước LG</Button>

        <Modal
          isOpen={size !== null}
          onClose={() => setSize(null)}
          size={size || 'md'}
          title={`Hộp thoại kích thước ${size?.toUpperCase()}`}
          description="Hệ thống hỗ trợ responsive tự co dãn trên thiết bị di động."
          footer={
            <Button variant="primary" onClick={() => setSize(null)}>
              Đóng lại
            </Button>
          }
        >
          <p>
            Nội dung bên trong hộp thoại thích ứng tốt với độ dài văn bản tiếng Việt và không bị vỡ layout trên mobile/tablet/desktop.
          </p>
        </Modal>
      </div>
    );
  },
};

export const DarkTheme: Story = {
  render: () => {
    const [isOpen, setIsOpen] = useState(false);

    return (
      <div className="p-4">
        <Button onClick={() => setIsOpen(true)}>Mở Modal Dark Mode</Button>
        <div className="dark">
          <Modal
            isOpen={isOpen}
            onClose={() => setIsOpen(false)}
            title="Đồng bộ Language Brain"
            description="Chế độ giao diện nền tối bảo vệ thị lực ban đêm."
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsOpen(false)}>
                  Để sau
                </Button>
                <Button variant="primary" onClick={() => setIsOpen(false)}>
                  Tiếp tục học
                </Button>
              </>
            }
          >
            <p>
              Dữ liệu học tập và chu kỳ FSRS đã được lưu trữ thành công trên bộ nhớ cục bộ và sẵn sàng đồng bộ.
            </p>
          </Modal>
        </div>
      </div>
    );
  },
};
