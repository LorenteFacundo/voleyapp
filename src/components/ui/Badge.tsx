import React from 'react';
import clsx from 'clsx';

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'court';
} & React.HTMLAttributes<HTMLSpanElement>;

const variantStyles = {
  default: 'bg-ink/10 text-ink/70',
  success: 'bg-green-100 text-green-700',
  warning: 'bg-sand/20 text-ink',
  danger: 'bg-red-100 text-red-700',
  court: 'bg-court/10 text-court',
};

export const Badge = React.memo<BadgeProps>(
  ({ variant = 'default', className, children, ...props }) => (
    <span
      className={clsx(
        'inline-flex items-center rounded-md px-2.5 py-1 text-xs font-bold uppercase tracking-wide',
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </span>
  )
);

Badge.displayName = 'Badge';
