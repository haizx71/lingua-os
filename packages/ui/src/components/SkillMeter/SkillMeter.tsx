import React from 'react';
import { Eye, Headphones, PenTool, Award } from 'lucide-react';
import { cn } from '../../utils';
import { Card } from '../Card/Card';
import { Progress } from '../Progress/Progress';

export type SkillType = 'recognition' | 'listening' | 'production';

export interface SkillItemData {
  type: SkillType;
  label: string;
  score: number;
  description?: string;
  levelBadge?: string;
}

export interface SkillMeterProps {
  skills?: {
    recognition?: number;
    listening?: number;
    production?: number;
  };
  singleSkill?: SkillItemData;
  showTitle?: boolean;
  className?: string;
}

const skillMetadata: Record<SkillType, { label: string; icon: React.ComponentType<{ className?: string }>; description: string; variant: 'primary' | 'success' | 'warning' }> = {
  recognition: {
    label: 'Nhận diện (Đọc & Ngữ cảnh)',
    icon: Eye,
    description: 'Khả năng nhận biết và hiểu từ vựng khi đọc bài học.',
    variant: 'primary',
  },
  listening: {
    label: 'Nghe hiểu (Âm thanh & IPA)',
    icon: Headphones,
    description: 'Khả năng nhận diện từ qua thính giác mà không cần xem chữ.',
    variant: 'success',
  },
  production: {
    label: 'Sản sinh (Gõ từ & Diễn đạt)',
    icon: PenTool,
    description: 'Khả năng tự nhớ chính xác và chủ động gõ từ trong bài tập.',
    variant: 'warning',
  },
};

export const SkillMeter: React.FC<SkillMeterProps> = ({
  skills,
  singleSkill,
  showTitle = true,
  className,
}) => {
  if (singleSkill) {
    const meta = skillMetadata[singleSkill.type];
    const Icon = meta.icon;

    return (
      <div className={cn('space-y-2 font-sans', className)}>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Icon className="w-4 h-4 text-[var(--action-primary)]" aria-hidden="true" />

            <span className="text-sm font-semibold text-[var(--text-primary,#0F172A)]">
              {singleSkill.label || meta.label}
            </span>
          </div>
          <span className="text-sm font-bold text-[var(--text-primary,#0F172A)]">
            {singleSkill.score}%
          </span>
        </div>
        <Progress
          value={singleSkill.score}
          max={100}
          variant={meta.variant}
          size="md"
          label={singleSkill.label || meta.label}
        />
        {(singleSkill.description || meta.description) && (
          <p className="text-xs text-[var(--text-secondary,#475569)]">
            {singleSkill.description || meta.description}
          </p>
        )}
      </div>
    );
  }

  const items: SkillItemData[] = [
    {
      type: 'recognition',
      label: 'Nhận diện (Đọc)',
      score: skills?.recognition ?? 72,
      description: 'Độ nhạy khi nhận diện từ vựng trong bài đọc.',
    },
    {
      type: 'listening',
      label: 'Nghe hiểu (Thính giác)',
      score: skills?.listening ?? 54,
      description: 'Phản xạ nhận diện âm thanh bản xứ.',
    },
    {
      type: 'production',
      label: 'Sản sinh (Chủ động nhớ & Viết)',
      score: skills?.production ?? 38,
      description: 'Khả năng tự gõ và sử dụng từ trong câu.',
    },
  ];

  return (
    <Card
      variant="default"
      padding="lg"
      className={cn('space-y-5 font-sans', className)}
    >
      {showTitle && (
        <div className="border-b border-[var(--border-subtle,#E2E8F0)] pb-3">
          <h3 className="text-base sm:text-lg font-bold text-[var(--text-primary,#0F172A)]">
            Bằng chứng năng lực theo chiều kỹ năng
          </h3>
          <p className="text-xs text-[var(--text-secondary,#475569)] mt-0.5">
            Dữ liệu tích lũy từ các phiên tiếp nạp Reader và active recall trong Review.
          </p>
        </div>
      )}

      <div className="space-y-4">
        {items.map((item) => {
          const meta = skillMetadata[item.type];
          const Icon = meta.icon;

          return (
            <div key={item.type} className="space-y-1.5">
              <div className="flex items-center justify-between text-xs sm:text-sm">
                <div className="flex items-center gap-2 font-semibold text-[var(--text-primary,#0F172A)]">
                  <Icon className="w-4 h-4 text-[var(--action-primary)]" aria-hidden="true" />

                  <span>{item.label}</span>
                </div>
                <span className="font-bold text-[var(--text-primary,#0F172A)]">
                  {item.score}%
                </span>
              </div>
              <Progress
                value={item.score}
                max={100}
                variant={meta.variant}
                size="md"
                label={item.label}
              />
              <p className="text-[11px] text-[var(--text-secondary,#475569)]">
                {item.description}
              </p>
            </div>
          );
        })}
      </div>
    </Card>
  );
};
