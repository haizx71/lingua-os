import React from 'react';
import { AlertTriangle, CheckCircle2, Info, XCircle } from 'lucide-react';
import { cn } from '../../utils';

export interface InlineAlertProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'info' | 'success' | 'warning' | 'danger';
  title?: string;
}

export const InlineAlert = React.forwardRef<HTMLDivElement, InlineAlertProps>(
  ({ className, variant = 'info', title, children, ...props }, ref) => {
    const icons = {
      info: <Info className="w-5 h-5 text-[var(--status-info,#0284C7)] flex-shrink-0" />,
      success: <CheckCircle2 className="w-5 h-5 text-[var(--status-success,#059669)] flex-shrink-0" />,
      warning: <AlertTriangle className="w-5 h-5 text-[var(--status-warning,#D97706)] flex-shrink-0" />,
      danger: <XCircle className="w-5 h-5 text-[var(--status-danger,#E11D48)] flex-shrink-0" />,
    };

    const variantStyles = {
      info: 'bg-[var(--status-info-bg,#F0F9FF)] border-[var(--status-info-border,#BAE6FD)] text-sky-950 dark:text-sky-200',
      success:
        'bg-[var(--status-success-bg,#ECFDF5)] border-[var(--status-success-border,#A7F3D0)] text-emerald-950 dark:text-emerald-200',
      warning:
        'bg-[var(--status-warning-bg,#FFFBEB)] border-[var(--status-warning-border,#FDE68A)] text-amber-950 dark:text-amber-200',
      danger:
        'bg-[var(--status-danger-bg,#FFF1F2)] border-[var(--status-danger-border,#FECDD3)] text-rose-950 dark:text-rose-200',
    };

    return (
      <div
        ref={ref}
        role="alert"
        className={cn(
          'flex gap-3 p-3.5 sm:p-4 rounded-[var(--radius-md,0.625rem)] border text-sm',
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icons[variant]}
        <div className="flex flex-col gap-0.5 flex-1">
          {title && <span className="font-semibold text-sm leading-snug">{title}</span>}
          <div className="text-xs sm:text-sm leading-relaxed opacity-90">{children}</div>
        </div>
      </div>
    );
  }
);

InlineAlert.displayName = 'InlineAlert';
