import React from 'react';
import clsx from 'clsx';

type BadgeProps = {
  variant?: 'default' | 'success' | 'warning' | 'danger' | 'court' | 'info' | 'muted';
} & React.HTMLAttributes<HTMLSpanElement>;

const variantStyles = {
  default: 'bg-vb-light text-vb-gray',
  success: 'bg-green-100 text-green-800',
  warning: 'bg-amber-100 text-amber-900',
  danger: 'bg-red-100 text-red-800',
  court: 'bg-vb-orange-light text-orange-800',
  info: 'bg-blue-100 text-blue-900',
  muted: 'bg-ink/5 text-ink/65',
};

export function Badge({ variant = 'default', className, children, ...props }: BadgeProps) {
  return (
    <span
      className={clsx('inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-bold', variantStyles[variant], className)}
      {...props}
    >
      {children}
    </span>
  );
}
