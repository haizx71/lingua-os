import React, { useEffect, useRef, useId } from 'react';
import { X } from 'lucide-react';
import { cn } from '../../utils';

export interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  title?: React.ReactNode;
  description?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
  size?: 'sm' | 'md' | 'lg' | 'xl' | 'fullscreen';
  closeOnOverlayClick?: boolean;
  closeOnEsc?: boolean;
  showCloseButton?: boolean;
  className?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  description,
  children,
  footer,
  size = 'md',
  closeOnOverlayClick = true,
  closeOnEsc = true,
  showCloseButton = true,
  className,
}) => {
  const generatedId = useId();
  const titleId = `modal-title-${generatedId}`;
  const descId = `modal-desc-${generatedId}`;
  const modalRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (isOpen) {
      previouslyFocusedElement.current = document.activeElement as HTMLElement;

      const handleKeyDown = (e: KeyboardEvent) => {
        if (closeOnEsc && e.key === 'Escape') {
          e.preventDefault();
          onClose();
          return;
        }

        // Focus trap inside modal
        if (e.key === 'Tab' && modalRef.current) {
          const focusableElements = modalRef.current.querySelectorAll<HTMLElement>(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
          );
          if (focusableElements.length === 0) return;

          const firstElement = focusableElements[0];
          const lastElement = focusableElements[focusableElements.length - 1];

          if (e.shiftKey) {
            if (document.activeElement === firstElement) {
              e.preventDefault();
              lastElement.focus();
            }
          } else {
            if (document.activeElement === lastElement) {
              e.preventDefault();
              firstElement.focus();
            }
          }
        }
      };

      document.addEventListener('keydown', handleKeyDown);
      document.body.style.overflow = 'hidden';

      // Focus first element or modal itself
      requestAnimationFrame(() => {
        if (modalRef.current) {
          const firstInput = modalRef.current.querySelector<HTMLElement>(
            'button, input, select, textarea'
          );
          if (firstInput) {
            firstInput.focus();
          } else {
            modalRef.current.focus();
          }
        }
      });

      return () => {
        document.removeEventListener('keydown', handleKeyDown);
        document.body.style.overflow = '';
        if (previouslyFocusedElement.current) {
          previouslyFocusedElement.current.focus();
        }
      };
    }
  }, [isOpen, closeOnEsc, onClose]);

  if (!isOpen) return null;

  const sizeStyles = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    fullscreen: 'max-w-none w-full h-full m-0 rounded-none',
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 overflow-y-auto"
      role="presentation"
    >
      {/* Backdrop overlay */}
      <div
        className="fixed inset-0 bg-slate-950/60 backdrop-blur-sm transition-opacity"
        onClick={() => {
          if (closeOnOverlayClick) onClose();
        }}
        aria-hidden="true"
      />

      {/* Dialog box */}
      <div
        ref={modalRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={title ? titleId : undefined}
        aria-describedby={description ? descId : undefined}
        tabIndex={-1}
        className={cn(
          'relative w-full bg-[var(--surface-elevated,#FFFFFF)] text-[var(--text-primary,#0F172A)]',
          'rounded-[var(--radius-lg,1rem)] shadow-2xl border border-[var(--border-subtle,#E2E8F0)]',
          'flex flex-col overflow-hidden transition-all duration-200 outline-none z-10',
          sizeStyles[size],
          className
        )}
      >
        {/* Header */}
        {(title || showCloseButton) && (
          <div className="flex items-start justify-between px-6 py-5 border-b border-[var(--border-subtle,#E2E8F0)]">
            <div className="flex flex-col gap-1 pr-4">
              {title && (
                <h2
                  id={titleId}
                  className="text-lg sm:text-xl font-bold tracking-tight text-[var(--text-primary,#0F172A)]"
                >
                  {title}
                </h2>
              )}
              {description && (
                <p id={descId} className="text-xs sm:text-sm text-[var(--text-secondary,#475569)]">
                  {description}
                </p>
              )}
            </div>

            {showCloseButton && (
              <button
                type="button"
                onClick={onClose}
                aria-label="Đóng hộp thoại"
                className="p-2 rounded-lg text-[var(--text-muted,#94A3B8)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--surface-subtle,#F1F5F9)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center -mr-2 -mt-2"
              >
                <X className="w-5 h-5" aria-hidden="true" />
              </button>
            )}
          </div>
        )}

        {/* Content Body */}
        <div className="px-6 py-5 overflow-y-auto flex-1 text-sm text-[var(--text-secondary,#475569)] leading-relaxed">
          {children}
        </div>

        {/* Footer */}
        {footer && (
          <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle,#E2E8F0)] bg-[var(--surface-subtle,#F1F5F9)]/50">
            {footer}
          </div>
        )}
      </div>
    </div>
  );
};

export const Dialog = Modal;

export interface ModalHeaderProps extends React.HTMLAttributes<HTMLDivElement> {}
export const ModalHeader: React.FC<ModalHeaderProps> = ({ className, children, ...props }) => (
  <div className={cn('px-6 py-5 border-b border-[var(--border-subtle,#E2E8F0)]', className)} {...props}>
    {children}
  </div>
);

export interface ModalBodyProps extends React.HTMLAttributes<HTMLDivElement> {}
export const ModalBody: React.FC<ModalBodyProps> = ({ className, children, ...props }) => (
  <div className={cn('px-6 py-5 overflow-y-auto flex-1 text-sm text-[var(--text-secondary,#475569)]', className)} {...props}>
    {children}
  </div>
);

export interface ModalFooterProps extends React.HTMLAttributes<HTMLDivElement> {}
export const ModalFooter: React.FC<ModalFooterProps> = ({ className, children, ...props }) => (
  <div className={cn('flex items-center justify-end gap-3 px-6 py-4 border-t border-[var(--border-subtle,#E2E8F0)] bg-[var(--surface-subtle,#F1F5F9)]/50', className)} {...props}>
    {children}
  </div>
);
