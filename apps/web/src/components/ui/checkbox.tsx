'use client';

import * as React from 'react';
import { cn } from '@/lib/utils';

export interface CheckboxProps
  extends Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'onChange'> {
  checked?: boolean;
  onCheckedChange?: (checked: boolean) => void;
}

const Checkbox = React.forwardRef<HTMLButtonElement, CheckboxProps>(
  ({ className, checked = false, onCheckedChange, onClick, ...props }, ref) => {
    const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
      onCheckedChange?.(!checked);
      onClick?.(e);
    };

    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={checked}
        ref={ref}
        onClick={handleClick}
        className={cn(
          'h-4 w-4 shrink-0 rounded-sm border border-(--primary) ring-offset-(--background)',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-(--ring) focus-visible:ring-offset-2',
          'disabled:cursor-not-allowed disabled:opacity-50',
          'cursor-pointer transition-colors flex items-center justify-center',
          checked && 'bg-(--primary) text-(--primary-foreground)',
          className
        )}
        {...props}
      >
        {checked && (
          <svg
            className="h-3 w-3 text-(--primary-foreground)"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={3}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M5 13l4 4L19 7"
            />
          </svg>
        )}
      </button>
    );
  }
);
Checkbox.displayName = 'Checkbox';

export { Checkbox };
