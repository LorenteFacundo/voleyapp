import React from 'react';
import clsx from 'clsx';

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'court';
} & React.HTMLAttributes<HTMLSpanElement>;

const variantStyles = {
  default: 'bg-vb-light text-vb-gray',
  success: 'bg-vb-green/10 text-vb-green',
  warning: 'bg-vb-yellow/20 text-vb-gray',
  danger: 'bg-vb-red/10 text-vb-red',
  court: 'bg-vb-orange-light text-vb-orange',
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
