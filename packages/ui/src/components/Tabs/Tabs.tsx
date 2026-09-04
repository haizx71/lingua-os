import React, { createContext, useContext, useState, useRef, useId } from 'react';
import { cn } from '../../utils';

interface TabsContextValue {
  value: string;
  onValueChange: (value: string) => void;
  variant: 'line' | 'pill';
  size: 'sm' | 'md' | 'lg';
  baseId: string;
}

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext() {
  const context = useContext(TabsContext);
  if (!context) {
    throw new Error('Tabs compound components must be used within a Tabs container');
  }
  return context;
}

export interface TabItem {
  id: string;
  label: React.ReactNode;
  content?: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export interface TabsProps {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  variant?: 'line' | 'pill';
  size?: 'sm' | 'md' | 'lg';
  items?: TabItem[];
  className?: string;
  children?: React.ReactNode;
}

export const Tabs: React.FC<TabsProps> = ({
  value: controlledValue,
  defaultValue = '',
  onValueChange,
  variant = 'line',
  size = 'md',
  items,
  className,
  children,
}) => {
  const generatedId = useId();
  const initialValue = controlledValue ?? defaultValue ?? (items && items[0]?.id) ?? '';
  const [uncontrolledValue, setUncontrolledValue] = useState(initialValue);

  const activeValue = controlledValue !== undefined ? controlledValue : uncontrolledValue;

  const handleValueChange = (newVal: string) => {
    if (controlledValue === undefined) {
      setUncontrolledValue(newVal);
    }
    onValueChange?.(newVal);
  };

  const contextValue: TabsContextValue = {
    value: activeValue,
    onValueChange: handleValueChange,
    variant,
    size,
    baseId: generatedId,
  };

  return (
    <TabsContext.Provider value={contextValue}>
      <div className={cn('w-full flex flex-col', className)}>
        {items ? (
          <>
            <TabsList>
              {items.map((item) => (
                <TabsTrigger
                  key={item.id}
                  value={item.id}
                  disabled={item.disabled}
                  icon={item.icon}
                  badge={item.badge}
                >
                  {item.label}
                </TabsTrigger>
              ))}
            </TabsList>
            {items.map((item) => (
              <TabsContent key={item.id} value={item.id}>
                {item.content}
              </TabsContent>
            ))}
          </>
        ) : (
          children
        )}
      </div>
    </TabsContext.Provider>
  );
};

export interface TabsListProps extends React.HTMLAttributes<HTMLDivElement> {
  ariaLabel?: string;
}

export const TabsList = React.forwardRef<HTMLDivElement, TabsListProps>(
  ({ className, ariaLabel = 'Navigation Tabs', children, ...props }, ref) => {
    const { variant, size } = useTabsContext();
    const listRef = useRef<HTMLDivElement>(null);

    const handleKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
      const container = listRef.current;
      if (!container) return;

      const triggers = Array.from(
        container.querySelectorAll<HTMLButtonElement>('[role="tab"]:not([disabled])')
      );
      const currentIndex = triggers.findIndex((el) => el === document.activeElement);

      if (currentIndex === -1) return;

      let nextIndex = currentIndex;
      if (e.key === 'ArrowRight') {
        e.preventDefault();
        nextIndex = (currentIndex + 1) % triggers.length;
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        nextIndex = (currentIndex - 1 + triggers.length) % triggers.length;
      } else if (e.key === 'Home') {
        e.preventDefault();
        nextIndex = 0;
      } else if (e.key === 'End') {
        e.preventDefault();
        nextIndex = triggers.length - 1;
      }

      if (nextIndex !== currentIndex) {
        triggers[nextIndex].focus();
        triggers[nextIndex].click();
      }
    };

    const variantClasses = {
      line: 'border-b border-[var(--border-subtle,#E2E8F0)] gap-6',
      pill: 'bg-[var(--surface-subtle,#F1F5F9)] p-1 rounded-[var(--radius-md,0.625rem)] gap-1 inline-flex',
    };

    return (
      <div
        ref={(node) => {
          (listRef as React.MutableRefObject<HTMLDivElement | null>).current = node;
          if (typeof ref === 'function') ref(node);
          else if (ref) (ref as React.MutableRefObject<HTMLDivElement | null>).current = node;
        }}
        role="tablist"
        aria-label={ariaLabel}
        onKeyDown={handleKeyDown}
        className={cn(
          'flex items-center',
          variantClasses[variant],
          className
        )}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsList.displayName = 'TabsList';

export interface TabsTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  icon?: React.ReactNode;
  badge?: React.ReactNode;
}

export const TabsTrigger = React.forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ className, value, icon, badge, disabled, children, ...props }, ref) => {
    const { value: activeValue, onValueChange, variant, size, baseId } = useTabsContext();
    const isSelected = activeValue === value;

    const tabId = `tab-${baseId}-${value}`;
    const panelId = `panel-${baseId}-${value}`;

    const sizeStyles = {
      sm: 'text-xs py-1.5 px-2.5 min-h-[32px] gap-1.5',
      md: 'text-sm py-2 px-3.5 min-h-[40px] gap-2',
      lg: 'text-base py-2.5 px-4 min-h-[48px] gap-2.5',
    };

    const variantStyles = {
      line: cn(
        'border-b-2 font-medium transition-all -mb-[1px] relative select-none',
        isSelected
          ? 'border-[var(--action-primary,#4F46E5)] text-[var(--action-primary,#4F46E5)] font-semibold'
          : 'border-transparent text-[var(--text-secondary,#475569)] hover:text-[var(--text-primary,#0F172A)] hover:border-[var(--border-default,#CBD5E1)]'
      ),
      pill: cn(
        'rounded-[var(--radius-sm,0.375rem)] font-medium transition-all select-none',
        isSelected
          ? 'bg-[var(--surface,#FFFFFF)] text-[var(--text-primary,#0F172A)] shadow-sm font-semibold'
          : 'text-[var(--text-secondary,#475569)] hover:text-[var(--text-primary,#0F172A)] hover:bg-[var(--surface-subtle,#F1F5F9)]'
      ),
    };

    return (
      <button
        ref={ref}
        id={tabId}
        role="tab"
        type="button"
        aria-selected={isSelected}
        aria-controls={panelId}
        tabIndex={isSelected ? 0 : -1}
        disabled={disabled}
        onClick={() => onValueChange(value)}
        className={cn(
          'inline-flex items-center justify-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)] disabled:opacity-40 disabled:cursor-not-allowed',
          sizeStyles[size],
          variantStyles[variant],
          className
        )}
        {...props}
      >
        {icon && <span className="flex-shrink-0" aria-hidden="true">{icon}</span>}
        <span>{children}</span>
        {badge && <span className="ml-1 flex-shrink-0">{badge}</span>}
      </button>
    );
  }
);
TabsTrigger.displayName = 'TabsTrigger';

export interface TabsContentProps extends React.HTMLAttributes<HTMLDivElement> {
  value: string;
}

export const TabsContent = React.forwardRef<HTMLDivElement, TabsContentProps>(
  ({ className, value, children, ...props }, ref) => {
    const { value: activeValue, baseId } = useTabsContext();
    const isSelected = activeValue === value;

    const tabId = `tab-${baseId}-${value}`;
    const panelId = `panel-${baseId}-${value}`;

    if (!isSelected) return null;

    return (
      <div
        ref={ref}
        id={panelId}
        role="tabpanel"
        aria-labelledby={tabId}
        tabIndex={0}
        className={cn('pt-4 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring,#6366F1)]', className)}
        {...props}
      >
        {children}
      </div>
    );
  }
);
TabsContent.displayName = 'TabsContent';
