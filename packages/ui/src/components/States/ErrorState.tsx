import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import { cn } from '../../utils';
import { Button } from '../Button/Button';

export interface ErrorStateProps extends React.HTMLAttributes<HTMLDivElement> {
  title?: string;
  message?: string;
  description?: string;
  code?: string;
  onRetry?: () => void;
  retryLabel?: string;
  isRetrying?: boolean;
}

const defaultErrorMessages: Record<string, { title: string; message: string }> = {
  UNAUTHENTICATED: {
    title: 'Cần đăng nhập',
    message: 'Phiên học của bạn đã hết hạn. Vui lòng đăng nhập lại để tiếp tục.',
  },
  FORBIDDEN: {
    title: 'Không có quyền truy cập',
    message: 'Bạn không có quyền xem hoặc chỉnh sửa nội dung này.',
  },
  NOT_FOUND: {
    title: 'Không tìm thấy nội dung',
    message: 'Nội dung bài học hoặc từ vựng này không tồn tại hoặc đã được chuyển đi.',
  },
  VALIDATION_ERROR: {
    title: 'Dữ liệu không hợp lệ',
    message: 'Có lỗi trong thông tin gửi lên. Vui lòng kiểm tra lại.',
  },
  INTERNAL_ERROR: {
    title: 'Hệ thống gặp sự cố',
    message: 'Máy chủ tạm thời không thể xử lý yêu cầu. Vui lòng thử lại sau ít phút.',
  },
};

export const ErrorState = React.forwardRef<HTMLDivElement, ErrorStateProps>(
  (
    {
      className,
      code,
      title,
      message,
      description,
      onRetry,
      retryLabel = 'Thử lại',
      isRetrying = false,
      ...props
    },
    ref
  ) => {
    const errorInfo = code && defaultErrorMessages[code] ? defaultErrorMessages[code] : undefined;
    const finalTitle = title || errorInfo?.title || 'Không thể tải nội dung';
    const finalMessage =
      message || description || errorInfo?.message || 'Đã có lỗi xảy ra trong quá trình xử lý. Hãy thử lại.';

    return (
      <div
        ref={ref}
        role="alert"
        aria-live="assertive"
        className={cn(
          'flex flex-col items-center justify-center p-8 sm:p-12 text-center rounded-[var(--radius-lg,1rem)] border border-[var(--status-danger-border,#FECDD3)] bg-[var(--surface,#FFFFFF)] max-w-md mx-auto my-6',
          className
        )}
        {...props}
      >
        <div className="w-14 h-14 rounded-full bg-[var(--status-danger-bg,#FFF1F2)] flex items-center justify-center mb-4 text-[var(--status-danger,#E11D48)]">
          <AlertCircle className="w-8 h-8" aria-hidden="true" />
        </div>
        <h3 className="text-lg font-semibold text-[var(--text-primary,#0F172A)] mb-1">{finalTitle}</h3>
        <p className="text-sm text-[var(--text-secondary,#475569)] mb-6 max-w-xs">{finalMessage}</p>
        {code && (
          <span className="text-xs font-mono text-[var(--text-muted,#94A3B8)] mb-4">
            Mã lỗi: {code}
          </span>
        )}
        {onRetry && (
          <Button
            variant="secondary"
            onClick={onRetry}
            isLoading={isRetrying}
            leftIcon={<RefreshCw className="w-4 h-4" />}
          >
            {retryLabel}
          </Button>
        )}
      </div>
    );
  }
);

ErrorState.displayName = 'ErrorState';
