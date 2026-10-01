import React from 'react';
import clsx from 'clsx';

type ButtonProps = {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'blue' | 'success';
  size?: 'sm' | 'md' | 'lg' | 'icon';
  loading?: boolean;
  fullWidth?: boolean;
} & React.ButtonHTMLAttributes<HTMLButtonElement>;

const variantStyles = {
  primary: 'bg-vb-orange text-white hover:bg-vb-orange/90 shadow-card',
  secondary: 'border border-vb-gray/15 bg-white text-vb-gray hover:border-vb-orange hover:text-vb-orange',
  ghost: 'text-vb-gray/75 hover:text-vb-gray hover:bg-vb-gray/5',
  danger: 'bg-red-700 text-white hover:bg-red-800',
  blue: 'bg-vb-blue text-white hover:bg-vb-blue/90 shadow-card',
  success: 'bg-green-700 text-white hover:bg-green-800',
};

// Alturas mínimas pensadas para el pulgar (44 px en md).
const sizeStyles = {
  sm: 'min-h-9 px-3 text-sm',
  md: 'min-h-11 px-4 text-sm',
  lg: 'min-h-12 px-5 text-base',
  icon: 'h-11 w-11 p-0',
};

export function Spinner({ className }: { className?: string }) {
  return (
    <svg className={clsx('h-4 w-4 animate-spin', className)} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'primary', size = 'md', loading = false, fullWidth = false, className, disabled, children, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={clsx(
        'inline-flex select-none items-center justify-center gap-2 rounded-xl font-semibold transition-colors duration-150',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-vb-orange/60 focus-visible:ring-offset-2',
        variantStyles[variant],
        sizeStyles[size],
        fullWidth && 'w-full',
        (disabled || loading) && 'cursor-not-allowed opacity-60',
        className,
      )}
      {...props}
    >
      {loading && <Spinner />}
      {children}
    </button>
  ),
);

Button.displayName = 'Button';
